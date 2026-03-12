import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";

import type {
  ResolvedTimbotAccount,
  TimbotAccountConfig,
  TimbotOverflowPolicy,
  TimbotConfig,
  TimbotStreamingFallbackPolicy,
  TimbotStreamingMode,
} from "./types.js";
import { normalizeOptionalText } from "./config-text.js";
import { logSimple } from "./logger.js";

const DEFAULT_API_DOMAIN = "console.tim.qq.com";

function listConfiguredAccountIds(cfg: OpenClawConfig): string[] {
  const accounts = (cfg.channels?.timbot as TimbotConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listTimbotAccountIds(cfg: OpenClawConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultTimbotAccountId(cfg: OpenClawConfig): string {
  const timbotConfig = cfg.channels?.timbot as TimbotConfig | undefined;
  if (timbotConfig?.defaultAccount?.trim()) return timbotConfig.defaultAccount.trim();
  const ids = listTimbotAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: OpenClawConfig,
  accountId: string,
): TimbotAccountConfig | undefined {
  const accounts = (cfg.channels?.timbot as TimbotConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as TimbotAccountConfig | undefined;
}

function mergeTimbotAccountConfig(cfg: OpenClawConfig, accountId: string): TimbotAccountConfig {
  const raw = (cfg.channels?.timbot ?? {}) as TimbotConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  const merged = { ...base, ...account };
  
  return merged;
}

export function resolveTimbotAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedTimbotAccount {
  const accountId = normalizeAccountId(params.accountId);
  const timbotConfig = params.cfg.channels?.timbot as TimbotConfig | undefined;
  const baseEnabled = timbotConfig?.enabled !== false;
  const merged = mergeTimbotAccountConfig(params.cfg, accountId);
  const enabled = baseEnabled && merged.enabled !== false;

  // 从合并后的配置中提取字段
  const sdkAppId = normalizeOptionalText(merged.sdkAppId);
  const identifier = normalizeOptionalText(merged.identifier);
  const secretKey = normalizeOptionalText(merged.secretKey);
  const botAccount = normalizeOptionalText(merged.botAccount);
  const apiDomain = normalizeOptionalText(merged.apiDomain) || DEFAULT_API_DOMAIN;
  const token = normalizeOptionalText(merged.token);
  const streamingMode: TimbotStreamingMode =
    merged.streamingMode === "custom_modify"
      ? "custom_modify"
      : merged.streamingMode === "text_modify"
        ? "text_modify"
        : merged.streamingMode === "tim_stream"
          ? "tim_stream"
          : "off";
  const fallbackPolicy: TimbotStreamingFallbackPolicy =
    merged.fallbackPolicy === "final_text"
      ? "final_text"
      : "strict";
  const overflowPolicy: TimbotOverflowPolicy =
    merged.overflowPolicy === "split"
      || !merged.overflowPolicy
      ? "split"
      : "stop";

  // 配置完整需要 sdkAppId + secretKey（identifier 可选，默认使用 administrator）
  const configured = Boolean(sdkAppId && secretKey);

  // 配置不完整时输出警告
  if (!configured && Boolean(timbotConfig)) {
    const missing: string[] = [];
    if (!sdkAppId) missing.push("sdkAppId");
    if (!secretKey) missing.push("secretKey");
    if (missing.length > 0) {
      logSimple("warn", `配置不完整，缺少: ${missing.join(", ")}`);
    }
  }

  return {
    accountId,
    name: normalizeOptionalText(merged.name),
    enabled,
    configured,
    sdkAppId,
    identifier,
    secretKey,
    botAccount,
    apiDomain,
    token,
    streamingMode,
    fallbackPolicy,
    overflowPolicy,
    config: merged,
  };
}

export function listEnabledTimbotAccounts(cfg: OpenClawConfig): ResolvedTimbotAccount[] {
  return listTimbotAccountIds(cfg)
    .map((accountId) => resolveTimbotAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
