import type {
  ChannelAccountSnapshot,
  ChannelPlugin,
  ClawdbotConfig,
} from "clawdbot/plugin-sdk";
import {
  DEFAULT_ACCOUNT_ID,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  setAccountEnabledInConfigSection,
} from "clawdbot/plugin-sdk";

import { listTimbotAccountIds, resolveDefaultTimbotAccountId, resolveTimbotAccount } from "./accounts.js";
import { timbotConfigSchema } from "./config-schema.js";
import type { ResolvedTimbotAccount } from "./types.js";
import { registerTimbotWebhookTarget, sendTimbotMessage } from "./monitor.js";

const meta = {
  id: "timbot",
  label: "Tencent IM",
  selectionLabel: "Tencent IM (plugin)",
  docsPath: "/channels/timbot",
  docsLabel: "timbot",
  blurb: "Tencent Cloud IM bot via webhooks + REST API.",
  aliases: ["tencentim", "腾讯im", "即时通信"],
  order: 85,
  quickstartAllowFrom: true,
};

function normalizeTimbotMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^(timbot|tencentim):/i, "").trim() || undefined;
}

export const timbotPlugin: ChannelPlugin<ResolvedTimbotAccount> = {
  id: "timbot",
  meta,
  capabilities: {
    chatTypes: ["direct"],
    media: false,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ["channels.timbot"] },
  configSchema: timbotConfigSchema,
  config: {
    listAccountIds: (cfg) => listTimbotAccountIds(cfg as ClawdbotConfig),
    resolveAccount: (cfg, accountId) => resolveTimbotAccount({ cfg: cfg as ClawdbotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultTimbotAccountId(cfg as ClawdbotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as ClawdbotConfig,
        sectionKey: "timbot",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as ClawdbotConfig,
        sectionKey: "timbot",
        clearBaseFields: ["name", "webhookPath", "sdkAppId", "identifier", "userSig", "botAccount", "apiDomain", "welcomeText"],
        accountId,
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      webhookPath: account.config.webhookPath ?? "/timbot",
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveTimbotAccount({ cfg: cfg as ClawdbotConfig, accountId });
      return (account.config.dm?.allowFrom ?? []).map((entry) => String(entry));
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => entry.toLowerCase()),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }) => {
      const resolvedAccountId = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const useAccountPath = Boolean((cfg as ClawdbotConfig).channels?.timbot?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.timbot.accounts.${resolvedAccountId}.` : "channels.timbot.";
      return {
        policy: account.config.dm?.policy ?? "open",
        allowFrom: (account.config.dm?.allowFrom ?? []).map((entry) => String(entry)),
        policyPath: `${basePath}dm.policy`,
        allowFromPath: `${basePath}dm.allowFrom`,
        approveHint: formatPairingApproveHint("timbot"),
        normalizeEntry: (raw) => raw.trim().toLowerCase(),
      };
    },
  },
  groups: {
    resolveRequireMention: () => true,
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
  messaging: {
    normalizeTarget: normalizeTimbotMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => Boolean(raw.trim()),
      hint: "<userid>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunkerMode: "text",
    textChunkLimit: 10000,
    sendText: async ({ account, target, text }) => {
      const result = await sendTimbotMessage({
        account,
        toAccount: target,
        text,
        fromAccount: account.botAccount,
      });

      return {
        channel: "timbot",
        ok: result.ok,
        messageId: result.messageId ?? "",
        error: result.error ? new Error(result.error) : undefined,
      };
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      webhookPath: snapshot.webhookPath ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      lastInboundAt: snapshot.lastInboundAt ?? null,
      lastOutboundAt: snapshot.lastOutboundAt ?? null,
      probe: snapshot.probe,
      lastProbeAt: snapshot.lastProbeAt ?? null,
    }),
    probeAccount: async () => ({ ok: true }),
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      webhookPath: account.config.webhookPath ?? "/timbot",
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      dmPolicy: account.config.dm?.policy ?? "open",
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      // 打印配置信息用于调试
      console.log(`[timbot] 启动账号: ${account.accountId}`);
      console.log(`[timbot] 配置状态: configured=${account.configured}, enabled=${account.enabled}`);
      console.log(`[timbot] sdkAppId=${account.sdkAppId ?? "[未设置]"}, identifier=${account.identifier ?? "[未设置]"}, userSig=${account.userSig ?? "[未设置]"}`);
      
      if (!account.configured) {
        ctx.log?.warn(`[${account.accountId}] timbot not configured; skipping webhook registration`);
        ctx.setStatus({ accountId: account.accountId, running: false, configured: false });
        return { stop: () => {} };
      }
      const path = (account.config.webhookPath ?? "/timbot").trim();
      const unregister = registerTimbotWebhookTarget({
        account,
        config: ctx.cfg as ClawdbotConfig,
        runtime: ctx.runtime,
        core: ({} as unknown) as any,
        path,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
      });
      ctx.log?.info(`[${account.accountId}] timbot webhook registered at ${path}`);
      console.log(`[timbot] webhook 注册成功, 账号: ${account.accountId}, 路径: ${path}`);
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        configured: true,
        webhookPath: path,
        lastStartAt: Date.now(),
      });
      return {
        stop: () => {
          unregister();
          ctx.setStatus({
            accountId: account.accountId,
            running: false,
            lastStopAt: Date.now(),
          });
        },
      };
    },
    stopAccount: async (ctx) => {
      ctx.setStatus({
        accountId: ctx.account.accountId,
        running: false,
        lastStopAt: Date.now(),
      });
    },
  },
};
