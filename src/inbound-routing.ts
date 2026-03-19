import type {
  ResolvedTimbotAccount,
  TimbotInboundMessage,
  TimbotMsgBodyElement,
} from "./types.js";

export type TimbotWebhookRoutingTarget = {
  account: Pick<ResolvedTimbotAccount, "configured" | "sdkAppId" | "botAccount" | "token">;
};

function normalizeBotAccount(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/^＠/u, "@").toLowerCase();
}

function extractMentionedBotAccountsFromField(msg: TimbotInboundMessage): string[] {
  const mentions = Array.isArray(msg.AtRobots_Account) ? msg.AtRobots_Account : [];
  const normalizedMentions: string[] = [];
  const seen = new Set<string>();

  for (const mention of mentions) {
    const normalized = normalizeBotAccount(mention);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedMentions.push(mention.replace(/^＠/u, "@"));
  }

  return normalizedMentions;
}

function isGroupMessage(msg: TimbotInboundMessage): boolean {
  return msg.CallbackCommand === "Bot.OnGroupMessage" || Boolean(msg.GroupId?.trim());
}

// 从 MsgBody 提取文本内容
export function extractTextFromMsgBody(msgBody?: TimbotMsgBodyElement[]): string {
  if (!msgBody || !Array.isArray(msgBody)) return "";

  const texts: string[] = [];
  for (const elem of msgBody) {
    if (elem.MsgType === "TIMTextElem" && elem.MsgContent?.Text) {
      texts.push(elem.MsgContent.Text);
    } else if (elem.MsgType === "TIMCustomElem") {
      texts.push("[custom]");
    } else if (elem.MsgType === "TIMImageElem") {
      texts.push("[image]");
    } else if (elem.MsgType === "TIMSoundElem") {
      texts.push("[voice]");
    } else if (elem.MsgType === "TIMFileElem") {
      texts.push("[file]");
    } else if (elem.MsgType === "TIMVideoFileElem") {
      texts.push("[video]");
    } else if (elem.MsgType === "TIMFaceElem") {
      texts.push("[face]");
    } else if (elem.MsgType === "TIMLocationElem") {
      texts.push("[location]");
    } else if (elem.MsgType === "TIMStreamElem") {
      texts.push("[stream]");
    }
  }

  return texts.join("\n");
}

export function extractMentionedBotAccounts(rawBody: string): string[] {
  if (!rawBody.trim()) return [];

  const matches = rawBody.match(/[@＠]RBT#[A-Za-z0-9._-]+/giu) ?? [];
  const mentions: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const normalized = normalizeBotAccount(match);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    mentions.push(match.replace(/^＠/u, "@"));
  }

  return mentions;
}

export function matchTimbotWebhookTargetsBySdkAppId<T extends TimbotWebhookRoutingTarget>(
  targets: T[],
  sdkAppId: string,
): T[] {
  const trimmed = sdkAppId.trim();
  if (!trimmed) return [...targets];
  return targets.filter((candidate) => candidate.account.sdkAppId === trimmed);
}

export function selectTimbotWebhookTarget<T extends TimbotWebhookRoutingTarget>(params: {
  targets: T[];
  msg: TimbotInboundMessage;
}): T | undefined {
  const configuredTargets = params.targets.filter((candidate) => candidate.account.configured);
  if (configuredTargets.length === 0) return undefined;

  const toAccount = normalizeBotAccount(params.msg.To_Account);
  if (toAccount) {
    const directMatch = configuredTargets.find(
      (candidate) => normalizeBotAccount(candidate.account.botAccount) === toAccount,
    );
    if (directMatch) return directMatch;
  }

  if (configuredTargets.length === 1) {
    return configuredTargets[0];
  }

  if (!isGroupMessage(params.msg)) {
    return undefined;
  }

  const mentionedAccounts = [
    ...extractMentionedBotAccountsFromField(params.msg),
    ...extractMentionedBotAccounts(extractTextFromMsgBody(params.msg.MsgBody)),
  ];
  const seenMentions = new Set<string>();
  for (const mentionedAccount of mentionedAccounts) {
    const normalizedMention = normalizeBotAccount(mentionedAccount);
    if (!normalizedMention || seenMentions.has(normalizedMention)) continue;
    seenMentions.add(normalizedMention);
    const matched = configuredTargets.find(
      (candidate) => normalizeBotAccount(candidate.account.botAccount) === normalizedMention,
    );
    if (matched) return matched;
  }

  return undefined;
}
