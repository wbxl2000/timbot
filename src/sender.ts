import type { ResolvedTimbotAccount } from "./types.js";

export function resolveOutboundFromAccount(
  account: ResolvedTimbotAccount,
  fallbackAccount?: string,
): string | undefined {
  return account.botAccount?.trim() || fallbackAccount?.trim() || undefined;
}

export function isSelfInboundMessage(
  account: ResolvedTimbotAccount,
  fromAccount: string,
  extraCandidates: string[] = [],
): boolean {
  const normalizedFrom = fromAccount.trim();
  if (!normalizedFrom) {
    return false;
  }

  const candidates = new Set<string>();
  if (account.botAccount?.trim()) {
    candidates.add(account.botAccount.trim());
  }
  if (account.identifier?.trim()) {
    candidates.add(account.identifier.trim());
  }
  for (const candidate of extraCandidates) {
    const normalizedCandidate = candidate.trim();
    if (normalizedCandidate) {
      candidates.add(normalizedCandidate);
    }
  }
  if (candidates.size === 0) {
    candidates.add("administrator");
  }

  return candidates.has(normalizedFrom);
}
