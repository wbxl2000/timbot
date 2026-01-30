import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "clawdbot/plugin-sdk";

import type { ResolvedTimbotAccount, TimbotAccountConfig, TimbotConfig } from "./types.js";

const DEFAULT_API_DOMAIN = "console.tim.qq.com";

function listConfiguredAccountIds(cfg: ClawdbotConfig): string[] {
  const accounts = (cfg.channels?.timbot as TimbotConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listTimbotAccountIds(cfg: ClawdbotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultTimbotAccountId(cfg: ClawdbotConfig): string {
  const timbotConfig = cfg.channels?.timbot as TimbotConfig | undefined;
  if (timbotConfig?.defaultAccount?.trim()) return timbotConfig.defaultAccount.trim();
  const ids = listTimbotAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: ClawdbotConfig,
  accountId: string,
): TimbotAccountConfig | undefined {
  const accounts = (cfg.channels?.timbot as TimbotConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as TimbotAccountConfig | undefined;
}

function mergeTimbotAccountConfig(cfg: ClawdbotConfig, accountId: string): TimbotAccountConfig {
  const raw = (cfg.channels?.timbot ?? {}) as TimbotConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  const merged = { ...base, ...account };
  
  return merged;
}

export function resolveTimbotAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedTimbotAccount {
  const accountId = normalizeAccountId(params.accountId);
  const timbotConfig = params.cfg.channels?.timbot as TimbotConfig | undefined;
  const baseEnabled = timbotConfig?.enabled !== false;
  const merged = mergeTimbotAccountConfig(params.cfg, accountId);
  const enabled = baseEnabled && merged.enabled !== false;

  // 从合并后的配置中提取字段
  const sdkAppId = merged.sdkAppId?.trim() || undefined;
  const identifier = merged.identifier?.trim() || undefined;
  const userSig = merged.userSig?.trim() || undefined;
  const botAccount = merged.botAccount?.trim() || undefined;
  const apiDomain = merged.apiDomain?.trim() || DEFAULT_API_DOMAIN;

  // 配置完整需要 sdkAppId + identifier + userSig
  const configured = Boolean(sdkAppId && identifier && userSig);

  // 调试日志：显示配置来源和解析结果
  const hasChannelConfig = Boolean(timbotConfig);
  const rawSdkAppId = merged.sdkAppId;
  const rawIdentifier = merged.identifier;
  const rawUserSig = merged.userSig;
  
  console.log(`[timbot] 解析账号配置: accountId=${accountId}`);
  console.log(`[timbot] channels.timbot 存在: ${hasChannelConfig}`);
  if (hasChannelConfig) {
    console.log(`[timbot] 原始配置值: sdkAppId=${rawSdkAppId ?? "[空]"}, identifier=${rawIdentifier ?? "[空]"}, userSig=${rawUserSig ?? "[空]"}`);
  }
  console.log(`[timbot] 解析结果: configured=${configured}, enabled=${enabled}`);

  if (!configured && hasChannelConfig) {
    const missing: string[] = [];
    if (!sdkAppId) missing.push("sdkAppId");
    if (!identifier) missing.push("identifier");
    if (!userSig) missing.push("userSig");
    if (missing.length > 0) {
      console.warn(`[timbot] ⚠️ 配置不完整，缺少: ${missing.join(", ")}`);
    }
  }

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    configured,
    sdkAppId,
    identifier,
    userSig,
    botAccount,
    apiDomain,
    config: merged,
  };
}

export function listEnabledTimbotAccounts(cfg: ClawdbotConfig): ResolvedTimbotAccount[] {
  return listTimbotAccountIds(cfg)
    .map((accountId) => resolveTimbotAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}
