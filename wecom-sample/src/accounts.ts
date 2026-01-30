import type { ClawdbotConfig } from "clawdbot/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "clawdbot/plugin-sdk";

import type { ResolvedWecomAccount, WecomAccountConfig, WecomConfig } from "./types.js";

function listConfiguredAccountIds(cfg: ClawdbotConfig): string[] {
  const accounts = (cfg.channels?.wecom as WecomConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return [];
  return Object.keys(accounts).filter(Boolean);
}

export function listWecomAccountIds(cfg: ClawdbotConfig): string[] {
  const ids = listConfiguredAccountIds(cfg);
  if (ids.length === 0) return [DEFAULT_ACCOUNT_ID];
  return ids.sort((a, b) => a.localeCompare(b));
}

export function resolveDefaultWecomAccountId(cfg: ClawdbotConfig): string {
  const wecomConfig = cfg.channels?.wecom as WecomConfig | undefined;
  if (wecomConfig?.defaultAccount?.trim()) return wecomConfig.defaultAccount.trim();
  const ids = listWecomAccountIds(cfg);
  if (ids.includes(DEFAULT_ACCOUNT_ID)) return DEFAULT_ACCOUNT_ID;
  return ids[0] ?? DEFAULT_ACCOUNT_ID;
}

function resolveAccountConfig(
  cfg: ClawdbotConfig,
  accountId: string,
): WecomAccountConfig | undefined {
  const accounts = (cfg.channels?.wecom as WecomConfig | undefined)?.accounts;
  if (!accounts || typeof accounts !== "object") return undefined;
  return accounts[accountId] as WecomAccountConfig | undefined;
}

function mergeWecomAccountConfig(cfg: ClawdbotConfig, accountId: string): WecomAccountConfig {
  const raw = (cfg.channels?.wecom ?? {}) as WecomConfig;
  const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
  const account = resolveAccountConfig(cfg, accountId) ?? {};
  return { ...base, ...account };
}

export function resolveWecomAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedWecomAccount {
  const accountId = normalizeAccountId(params.accountId);
  const baseEnabled = (params.cfg.channels?.wecom as WecomConfig | undefined)?.enabled !== false;
  const merged = mergeWecomAccountConfig(params.cfg, accountId);
  const enabled = baseEnabled && merged.enabled !== false;

  const token = merged.token?.trim() || undefined;
  const encodingAESKey = merged.encodingAESKey?.trim() || undefined;
  const receiveId = merged.receiveId?.trim() ?? "";
  const configured = Boolean(token && encodingAESKey);

  return {
    accountId,
    name: merged.name?.trim() || undefined,
    enabled,
    configured,
    token,
    encodingAESKey,
    receiveId,
    config: merged,
  };
}

export function listEnabledWecomAccounts(cfg: ClawdbotConfig): ResolvedWecomAccount[] {
  return listWecomAccountIds(cfg)
    .map((accountId) => resolveWecomAccount({ cfg, accountId }))
    .filter((account) => account.enabled);
}

