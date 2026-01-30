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

import { listWecomAccountIds, resolveDefaultWecomAccountId, resolveWecomAccount } from "./accounts.js";
import { wecomConfigSchema } from "./config-schema.js";
import type { ResolvedWecomAccount } from "./types.js";
import { registerWecomWebhookTarget } from "./monitor.js";

const meta = {
  id: "wecom",
  label: "WeCom",
  selectionLabel: "WeCom (plugin)",
  docsPath: "/channels/wecom",
  docsLabel: "wecom",
  blurb: "Enterprise WeCom intelligent bot (API mode) via encrypted webhooks + passive replies.",
  aliases: ["wechatwork", "wework", "qywx", "企微", "企业微信"],
  order: 85,
  quickstartAllowFrom: true,
};

function normalizeWecomMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^(wecom|wechatwork|wework|qywx):/i, "").trim() || undefined;
}

export const wecomPlugin: ChannelPlugin<ResolvedWecomAccount> = {
  id: "wecom",
  meta,
  capabilities: {
    chatTypes: ["direct", "group"],
    media: false,
    reactions: false,
    threads: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.wecom"] },
  configSchema: wecomConfigSchema,
  config: {
    listAccountIds: (cfg) => listWecomAccountIds(cfg as ClawdbotConfig),
    resolveAccount: (cfg, accountId) => resolveWecomAccount({ cfg: cfg as ClawdbotConfig, accountId }),
    defaultAccountId: (cfg) => resolveDefaultWecomAccountId(cfg as ClawdbotConfig),
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      setAccountEnabledInConfigSection({
        cfg: cfg as ClawdbotConfig,
        sectionKey: "wecom",
        accountId,
        enabled,
        allowTopLevel: true,
      }),
    deleteAccount: ({ cfg, accountId }) =>
      deleteAccountFromConfigSection({
        cfg: cfg as ClawdbotConfig,
        sectionKey: "wecom",
        clearBaseFields: ["name", "webhookPath", "token", "encodingAESKey", "receiveId", "welcomeText"],
        accountId,
      }),
    isConfigured: (account) => account.configured,
    describeAccount: (account): ChannelAccountSnapshot => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      webhookPath: account.config.webhookPath ?? "/wecom",
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveWecomAccount({ cfg: cfg as ClawdbotConfig, accountId });
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
      const useAccountPath = Boolean((cfg as ClawdbotConfig).channels?.wecom?.accounts?.[resolvedAccountId]);
      const basePath = useAccountPath ? `channels.wecom.accounts.${resolvedAccountId}.` : "channels.wecom.";
      return {
        policy: account.config.dm?.policy ?? "pairing",
        allowFrom: (account.config.dm?.allowFrom ?? []).map((entry) => String(entry)),
        policyPath: `${basePath}dm.policy`,
        allowFromPath: `${basePath}dm.allowFrom`,
        approveHint: formatPairingApproveHint("wecom"),
        normalizeEntry: (raw) => raw.trim().toLowerCase(),
      };
    },
  },
  groups: {
    // WeCom bots are usually mention-gated by the platform in groups already.
    resolveRequireMention: () => true,
  },
  threading: {
    resolveReplyToMode: () => "off",
  },
  messaging: {
    normalizeTarget: normalizeWecomMessagingTarget,
    targetResolver: {
      looksLikeId: (raw) => Boolean(raw.trim()),
      hint: "<userid|chatid>",
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunkerMode: "text",
    textChunkLimit: 20480,
    sendText: async () => {
      return {
        channel: "wecom",
        ok: false,
        messageId: "",
        error: new Error("WeCom intelligent bot only supports replying within callbacks (no standalone sendText)."),
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
      webhookPath: account.config.webhookPath ?? "/wecom",
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
      dmPolicy: account.config.dm?.policy ?? "pairing",
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;
      if (!account.configured) {
        ctx.log?.warn(`[${account.accountId}] wecom not configured; skipping webhook registration`);
        ctx.setStatus({ accountId: account.accountId, running: false, configured: false });
        return { stop: () => {} };
      }
      const path = (account.config.webhookPath ?? "/wecom").trim();
      const unregister = registerWecomWebhookTarget({
        account,
        config: ctx.cfg as ClawdbotConfig,
        runtime: ctx.runtime,
        // The HTTP handler resolves the active PluginRuntime via getWecomRuntime().
        // The stored target only needs to be decrypt/verify-capable.
        core: ({} as unknown) as any,
        path,
        statusSink: (patch) => ctx.setStatus({ accountId: ctx.accountId, ...patch }),
      });
      ctx.log?.info(`[${account.accountId}] wecom webhook registered at ${path}`);
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
