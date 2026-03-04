/**
 * Author: YanHaidao
 */
import type { OpenClawConfig, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { listTimbotAccountIds, resolveTimbotAccount } from "./src/accounts.js";
import { handleTimbotWebhookRequest } from "./src/monitor.js";
import { setTimbotRuntime } from "./src/runtime.js";
import { timbotPlugin } from "./src/channel.js";

type PluginApiCompat = OpenClawPluginApi & {
  registerHttpHandler?: (handler: typeof handleTimbotWebhookRequest) => void;
  registerHttpRoute?: (params: {
    path: string;
    auth?: "gateway" | "plugin";
    match?: "exact" | "prefix";
    replaceExisting?: boolean;
    handler: (req: Parameters<typeof handleTimbotWebhookRequest>[0], res: Parameters<typeof handleTimbotWebhookRequest>[1]) => Promise<void> | void;
  }) => void;
};

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/timbot";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash;
}

function collectConfiguredWebhookPaths(cfg: OpenClawConfig): string[] {
  const paths = new Set<string>(["/timbot"]);
  for (const accountId of listTimbotAccountIds(cfg)) {
    const account = resolveTimbotAccount({ cfg, accountId });
    paths.add(normalizeWebhookPath(account.config.webhookPath ?? "/timbot"));
  }
  return [...paths];
}

function registerWebhookHttp(api: OpenClawPluginApi): void {
  const compatApi = api as PluginApiCompat;

  // OpenClaw <= 2026.1.x
  if (typeof compatApi.registerHttpHandler === "function") {
    compatApi.registerHttpHandler(handleTimbotWebhookRequest);
    return;
  }

  // OpenClaw >= 2026.3.x (no registerHttpHandler)
  if (typeof compatApi.registerHttpRoute === "function") {
    for (const path of collectConfiguredWebhookPaths(api.config as OpenClawConfig)) {
      compatApi.registerHttpRoute({
        path,
        auth: "plugin",
        match: "exact",
        handler: async (req, res) => {
          const handled = await handleTimbotWebhookRequest(req, res);
          if (!handled && !res.headersSent && !res.writableEnded) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end("Timbot webhook target not ready");
          }
        },
      });
    }
    return;
  }

  throw new TypeError("OpenClaw plugin API missing HTTP registration methods");
}

const plugin = {
  id: "timbot",
  name: "Tencent IM",
  description: "Tencent Cloud IM intelligent bot channel via webhooks + REST API",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi): void {
    setTimbotRuntime(api.runtime);
    api.registerChannel({ plugin: timbotPlugin });
    registerWebhookHttp(api);
  },
};

export default plugin;
