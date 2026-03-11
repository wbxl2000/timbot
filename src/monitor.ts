import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";

import type {
  ResolvedTimbotAccount,
  TimbotInboundMessage,
  TimbotMsgBodyElement,
  TimbotSendGroupMsgRequest,
  TimbotSendMsgResponse,
} from "./types.js";
import { getTimbotRuntime } from "./runtime.js";
import { genTestUserSig } from "./debug/GenerateTestUserSig-es.js";
import { LOG_PREFIX, logSimple } from "./logger.js";
import {
  allowsFinalTextRecovery,
  buildBotErrorPayload,
  buildBotStreamPayload,
  buildCustomMsgBody,
  buildStreamingMsgBody,
  buildTimStreamChunk,
  buildTimStreamMsgBody,
  buildTextMsgBody,
} from "./streaming-policy.js";
import type { TimbotTimStreamChunk } from "./streaming-policy.js";

export type TimbotRuntimeEnv = {
  log?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

type TimbotWebhookTarget = {
  account: ResolvedTimbotAccount;
  config: OpenClawConfig;
  runtime: TimbotRuntimeEnv;
  core: PluginRuntime;
  path: string;
  statusSink?: (patch: { lastInboundAt?: number; lastOutboundAt?: number }) => void;
};

const webhookTargets = new Map<string, TimbotWebhookTarget[]>();

// ============ 日志工具（带 target） ============

/** 带 target 的日志（有 runtime 回调） */
function log(target: TimbotWebhookTarget, level: "info" | "warn" | "error", message: string): void {
  const full = `${LOG_PREFIX} ${message}`;
  if (level === "error") {
    target.runtime.error?.(full);
  } else if (level === "warn") {
    (target.runtime.warn ?? target.runtime.log)?.(full);
  } else {
    target.runtime.log?.(full);
  }
}

/** verbose 日志（仅在 --verbose 时输出） */
function logVerbose(target: TimbotWebhookTarget, message: string): void {
  const should = target.core.logging?.shouldLogVerbose?.() ?? false;
  if (should) {
    const full = `${LOG_PREFIX} ${message}`;
    target.runtime.log?.(full);
  }
}

// ============ 工具函数 ============

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
  return withSlash;
}

function jsonOk(res: ServerResponse, body: unknown): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  return await new Promise<{ ok: boolean; value?: unknown; error?: string }>((resolve) => {
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        resolve({ ok: false, error: "payload too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw.trim()) {
          resolve({ ok: false, error: "empty payload" });
          return;
        }
        resolve({ ok: true, value: JSON.parse(raw) as unknown });
      } catch (err) {
        resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
    req.on("error", (err) => {
      resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
    });
  });
}

function resolvePath(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return normalizeWebhookPath(url.pathname || "/");
}

function resolveQueryParams(req: IncomingMessage): URLSearchParams {
  const url = new URL(req.url ?? "/", "http://localhost");
  return url.searchParams;
}

// 使用 secretKey 动态生成 userSig
function generateUserSig(account: ResolvedTimbotAccount): string | undefined {
  if (!account.sdkAppId || !account.secretKey) {
    return undefined;
  }
  const identifier = account.identifier || "administrator";
  const result = genTestUserSig({
    userID: identifier,
    SDKAppID: Number(account.sdkAppId),
    SecretKey: account.secretKey,
  });
  return result?.userSig;
}

// 构建腾讯 IM API URL
function buildTimbotApiUrl(account: ResolvedTimbotAccount, service: string, action: string): string {
  const domain = account.apiDomain || "console.tim.qq.com";
  const identifier = account.identifier || "administrator";
  const random = Math.floor(Math.random() * 4294967295);
  const userSig = generateUserSig(account) ?? "";
  return `https://${domain}/v4/${service}/${action}?sdkappid=${encodeURIComponent(account.sdkAppId ?? "")}&identifier=${encodeURIComponent(identifier)}&usersig=${encodeURIComponent(userSig)}&random=${random}&contenttype=json`;
}

function resolveOutboundSenderAccount(account: ResolvedTimbotAccount): string {
  return account.botAccount || account.identifier || "administrator";
}

const TIMBOT_PARTIAL_STREAM_THROTTLE_MS = 1000;
const TIMBOT_STREAM_SOFT_LIMIT_BYTES = 11 * 1024;
const TIMBOT_FINAL_TEXT_CHUNK_LIMIT = 3500;
const TIMBOT_OVERFLOW_NOTICE_TEXT = "内容较长，已停止发送剩余内容。";

function buildReplyRuntimeConfig(config: OpenClawConfig): {
  config: OpenClawConfig;
  disableBlockStreaming: boolean;
} {
  return {
    // timbot uses typingText -> final modify for non-streaming replies, and onPartialReply
    // for streaming replies. OpenClaw block streaming would conflict with both paths.
    config,
    disableBlockStreaming: true,
  };
}

function mergeStreamingText(previousText: string | undefined, nextText: string | undefined): string {
  const previous = typeof previousText === "string" ? previousText : "";
  const next = typeof nextText === "string" ? nextText : "";
  if (!next) {
    return previous;
  }
  if (!previous || next === previous) {
    return next;
  }
  if (next.startsWith(previous)) {
    return next;
  }
  if (previous.startsWith(next)) {
    return previous;
  }
  if (next.includes(previous)) {
    return next;
  }
  if (previous.includes(next)) {
    return previous;
  }

  const maxOverlap = Math.min(previous.length, next.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (previous.slice(-overlap) === next.slice(0, overlap)) {
      return `${previous}${next.slice(overlap)}`;
    }
  }
  return `${previous}${next}`;
}

function estimateMsgBodyBytes(msgBody: TimbotMsgBodyElement[]): number {
  return Buffer.byteLength(JSON.stringify(msgBody), "utf8");
}

function splitTextByFixedLength(text: string, limit: number): string[] {
  if (!text) {
    return [];
  }
  if (limit <= 0 || text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += limit) {
    chunks.push(text.slice(index, index + limit));
  }
  return chunks;
}

function isMsgTooLongError(error: string | undefined): boolean {
  return /msg too long/i.test(error ?? "");
}

function resolveStreamingFinalText(streamVisibleText: string, streamFallbackText: string): string {
  if (!streamVisibleText) {
    return streamFallbackText;
  }
  if (!streamFallbackText) {
    return streamVisibleText;
  }
  if (
    streamFallbackText.startsWith(streamVisibleText)
    || streamFallbackText.includes(streamVisibleText)
  ) {
    return streamFallbackText;
  }
  if (
    streamVisibleText.startsWith(streamFallbackText)
    || streamVisibleText.includes(streamFallbackText)
  ) {
    return streamVisibleText;
  }
  return streamFallbackText.length > streamVisibleText.length
    ? streamFallbackText
    : streamVisibleText;
}

function buildSnapshotStreamingMsgBody(params: {
  useCustomStreaming: boolean;
  text: string;
  isFinished: 0 | 1;
  typingText?: string;
}): TimbotMsgBodyElement[] {
  return buildStreamingMsgBody({
    useCustomStreaming: params.useCustomStreaming,
    chunks: params.text ? [params.text] : [],
    isFinished: params.isFinished,
    typingText: params.typingText,
  });
}

function createPartialTextAccumulator() {
  const committedSegments: string[] = [];
  let currentPartialText = "";

  const commitCurrentPartial = () => {
    if (!currentPartialText) {
      return;
    }
    if (committedSegments.at(-1) !== currentPartialText) {
      committedSegments.push(currentPartialText);
    }
    currentPartialText = "";
  };

  const getVisibleText = () => {
    const segments = currentPartialText
      ? [...committedSegments, currentPartialText]
      : [...committedSegments];
    return segments.filter(Boolean).join("\n\n");
  };

  return {
    noteAssistantMessageStart: () => {
      commitCurrentPartial();
    },
    absorbPartial: (text: string) => {
      currentPartialText = mergeStreamingText(currentPartialText, text);
      return getVisibleText();
    },
    getVisibleText,
  };
}

type LatestTextThrottleLoop = {
  update: (text: string) => void;
  flush: () => Promise<void>;
  stop: () => void;
  waitForInFlight: () => Promise<void>;
};

function createLatestTextThrottleLoop(params: {
  throttleMs: number;
  isStopped: () => boolean;
  sendLatestText: (text: string) => Promise<boolean>;
}): LatestTextThrottleLoop {
  let lastSentAt = 0;
  let pendingText = "";
  let inFlightPromise: Promise<boolean> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    while (!params.isStopped()) {
      if (inFlightPromise) {
        await inFlightPromise;
        continue;
      }
      const text = pendingText;
      if (!text) {
        pendingText = "";
        return;
      }
      pendingText = "";
      const current = params.sendLatestText(text).finally(() => {
        if (inFlightPromise === current) {
          inFlightPromise = undefined;
        }
      });
      inFlightPromise = current;
      const sent = await current;
      if (sent === false) {
        if (!params.isStopped()) {
          pendingText = text;
        }
        return;
      }
      lastSentAt = Date.now();
      if (!pendingText) {
        return;
      }
    }
  };

  const schedule = () => {
    if (timer) {
      return;
    }
    const delay = Math.max(0, params.throttleMs - (Date.now() - lastSentAt));
    timer = setTimeout(() => {
      void flush();
    }, delay);
  };

  return {
    update: (text: string) => {
      if (params.isStopped()) {
        return;
      }
      pendingText = text;
      if (inFlightPromise) {
        schedule();
        return;
      }
      if (!timer && Date.now() - lastSentAt >= params.throttleMs) {
        void flush();
        return;
      }
      schedule();
    },
    flush,
    stop: () => {
      pendingText = "";
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
    waitForInFlight: async () => {
      if (inFlightPromise) {
        await inFlightPromise;
      }
    },
  };
}

function isStreamingEnabled(mode: ResolvedTimbotAccount["streamingMode"]): boolean {
  return mode !== "off";
}

function isCustomStreamingMode(mode: ResolvedTimbotAccount["streamingMode"]): boolean {
  return mode === "custom_modify";
}

function isTimStreamMode(mode: ResolvedTimbotAccount["streamingMode"]): boolean {
  return mode === "tim_stream";
}

// ============ 流式传输适配器 ============

type StreamingMsgRef = { kind: "c2c"; msgKey: string } | { kind: "group"; msgSeq: number };

type StreamingTransport = {
  label: string;
  sendStreamMsg: (params: {
    chunks: TimbotTimStreamChunk[];
    compatibleText?: string;
    streamMsgId?: string;
  }) => Promise<{ ok: boolean; streamMsgId?: string; error?: string }>;
  modifyMsg: (params: {
    ref: StreamingMsgRef;
    msgBody: TimbotMsgBodyElement[];
  }) => Promise<{ ok: boolean; error?: string }>;
  sendMsgBody: (params: {
    msgBody: TimbotMsgBodyElement[];
  }) => Promise<{ ok: boolean; ref?: StreamingMsgRef; error?: string }>;
  sendText: (params: {
    text: string;
  }) => Promise<{ ok: boolean; error?: string }>;
};

async function sendTimbotMessageBody(params: {
  account: ResolvedTimbotAccount;
  toAccount: string;
  msgBody: TimbotMsgBodyElement[];
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { account, toAccount, msgBody, fromAccount, target } = params;

  // 辅助函数：根据是否有 target 选择日志方式
  const info = (msg: string) => target ? log(target, "info", msg) : logSimple("info", msg);
  const warn = (msg: string) => target ? log(target, "warn", msg) : logSimple("warn", msg);
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  verbose(`准备发送消息 -> ${toAccount}, 元素数: ${msgBody.length}`);

  if (!account.configured) {
    warn("发送失败: 账号未配置");
    return { ok: false, error: "account not configured" };
  }

  // 验证必需参数
  if (!account.sdkAppId || !account.secretKey) {
    const missing: string[] = [];
    if (!account.sdkAppId) missing.push("sdkAppId");
    if (!account.secretKey) missing.push("secretKey");
    error(`发送失败: 缺少必需参数: ${missing.join(", ")}`);
    verbose(`当前账号配置: sdkAppId=${account.sdkAppId}, secretKey=${account.secretKey ? "[已配置]" : "[空]"}`);
    return { ok: false, error: `missing required params: ${missing.join(", ")}` };
  }

  const url = buildTimbotApiUrl(account, "openim", "sendmsg");
  const msgRandom = Math.floor(Math.random() * 4294967295);

  const body: Record<string, unknown> = {
    SyncOtherMachine: 2, // 不同步到发送方
    To_Account: toAccount,
    MsgRandom: msgRandom,
    MsgBody: msgBody,
  };

  if (fromAccount) {
    body.From_Account = fromAccount;
  }

  // verbose 级别打印完整请求信息
  verbose(`发送请求 URL: ${url}`);
  verbose(`发送请求 Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    verbose(`HTTP 响应状态: ${response.status} ${response.statusText}`);
    
    const resultText = await response.text();
    verbose(`响应内容: ${resultText}`);
    
    let result: TimbotSendMsgResponse;
    try {
      result = JSON.parse(resultText) as TimbotSendMsgResponse;
    } catch {
      error("响应解析失败，非 JSON 格式");
      return { ok: false, error: `Invalid response: ${resultText.slice(0, 200)}` };
    }

    if (result.ActionStatus !== "OK") {
      error(`发送失败: ErrorCode=${result.ErrorCode}, ErrorInfo=${result.ErrorInfo}`);
      return { ok: false, error: result.ErrorInfo || `ErrorCode: ${result.ErrorCode}` };
    }

    info(`发送成功 -> ${toAccount}, messageId: ${result.MsgKey}`);
    return { ok: true, messageId: result.MsgKey };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`发送异常: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

// 发送腾讯 IM 消息
export async function sendTimbotMessage(params: {
  account: ResolvedTimbotAccount;
  toAccount: string;
  text: string;
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { text, ...rest } = params;
  return sendTimbotMessageBody({ ...rest, msgBody: buildTextMsgBody(text) });
}

async function sendTimbotGroupMessageBody(params: {
  account: ResolvedTimbotAccount;
  groupId: string;
  msgBody: TimbotMsgBodyElement[];
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; messageId?: string; msgSeq?: number; error?: string }> {
  const { account, groupId, msgBody, fromAccount, target } = params;

  const info = (msg: string) => target ? log(target, "info", msg) : logSimple("info", msg);
  const warn = (msg: string) => target ? log(target, "warn", msg) : logSimple("warn", msg);
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  verbose(`准备发送群消息 -> ${groupId}, 元素数: ${msgBody.length}`);

  if (!account.configured) {
    warn("发送失败: 账号未配置");
    return { ok: false, error: "account not configured" };
  }

  if (!account.sdkAppId || !account.secretKey) {
    const missing: string[] = [];
    if (!account.sdkAppId) missing.push("sdkAppId");
    if (!account.secretKey) missing.push("secretKey");
    error(`发送失败: 缺少必需参数: ${missing.join(", ")}`);
    return { ok: false, error: `missing required params: ${missing.join(", ")}` };
  }

  const url = buildTimbotApiUrl(account, "group_open_http_svc", "send_group_msg");
  const msgRandom = Math.floor(Math.random() * 4294967295);

  const body: TimbotSendGroupMsgRequest = {
    GroupId: groupId,
    Random: msgRandom,
    MsgBody: msgBody,
  };

  if (fromAccount) {
    body.From_Account = fromAccount;
  }

  verbose(`发送群消息请求 URL: ${url}`);
  verbose(`发送群消息请求 Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    verbose(`HTTP 响应状态: ${response.status} ${response.statusText}`);

    const resultText = await response.text();
    verbose(`响应内容: ${resultText}`);

    let result: TimbotSendMsgResponse;
    try {
      result = JSON.parse(resultText) as TimbotSendMsgResponse;
    } catch {
      error("响应解析失败，非 JSON 格式");
      return { ok: false, error: `Invalid response: ${resultText.slice(0, 200)}` };
    }

    if (result.ActionStatus !== "OK") {
      error(`群消息发送失败: ErrorCode=${result.ErrorCode}, ErrorInfo=${result.ErrorInfo}`);
      return { ok: false, error: result.ErrorInfo || `ErrorCode: ${result.ErrorCode}` };
    }

    info(`群消息发送成功 -> ${groupId}, messageId: ${result.MsgKey}, msgSeq: ${result.MsgSeq}`);
    return { ok: true, messageId: result.MsgKey, msgSeq: result.MsgSeq };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`群消息发送异常: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

// 发送腾讯 IM 群消息
export async function sendTimbotGroupMessage(params: {
  account: ResolvedTimbotAccount;
  groupId: string;
  text: string;
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; messageId?: string; msgSeq?: number; error?: string }> {
  const { text, ...rest } = params;
  return sendTimbotGroupMessageBody({ ...rest, msgBody: buildTextMsgBody(text) });
}

async function sendTimbotC2CStreamMessage(params: {
  account: ResolvedTimbotAccount;
  toAccount: string;
  chunks: TimbotTimStreamChunk[];
  compatibleText?: string;
  streamMsgId?: string;
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; streamMsgId?: string; error?: string }> {
  const {
    account,
    toAccount,
    chunks,
    compatibleText,
    streamMsgId,
    fromAccount,
    target,
  } = params;

  const warn = (msg: string) => target ? log(target, "warn", msg) : logSimple("warn", msg);
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  if (!account.configured) {
    warn("发送流式消息失败: 账号未配置");
    return { ok: false, error: "account not configured" };
  }

  if (!account.sdkAppId || !account.secretKey) {
    const missing: string[] = [];
    if (!account.sdkAppId) missing.push("sdkAppId");
    if (!account.secretKey) missing.push("secretKey");
    error(`发送流式消息失败: 缺少必需参数: ${missing.join(", ")}`);
    return { ok: false, error: `missing required params: ${missing.join(", ")}` };
  }

  const url = buildTimbotApiUrl(account, "stream_msg", "send_c2c_stream_msg");
  const msgRandom = Math.floor(Math.random() * 4294967295);
  const body: Record<string, unknown> = {
    SyncOtherMachine: 2,
    To_Account: toAccount,
    MsgRandom: msgRandom,
    MsgBody: buildTimStreamMsgBody({
      chunks,
      compatibleText,
      streamMsgId,
    }),
  };

  if (fromAccount) {
    body.From_Account = fromAccount;
  }

  verbose(`C2C 流式消息请求 URL: ${url}`);
  verbose(`C2C 流式消息请求 Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    verbose(`C2C 流式消息 HTTP 响应状态: ${response.status} ${response.statusText}`);
    const resultText = await response.text();
    verbose(`C2C 流式消息响应内容: ${resultText}`);
    let result: TimbotSendMsgResponse;
    try {
      result = JSON.parse(resultText) as TimbotSendMsgResponse;
    } catch {
      error("C2C 流式消息响应解析失败，非 JSON 格式");
      return { ok: false, error: `Invalid response: ${resultText.slice(0, 200)}` };
    }
    if (result.ActionStatus !== "OK") {
      error(`C2C 流式消息发送失败: ErrorCode=${result.ErrorCode}, ErrorInfo=${result.ErrorInfo}`);
      return { ok: false, error: result.ErrorInfo || `ErrorCode: ${result.ErrorCode}` };
    }
    return { ok: true, streamMsgId: result.StreamMsgID?.trim() || streamMsgId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`C2C 流式消息发送异常: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

async function sendTimbotGroupStreamMessage(params: {
  account: ResolvedTimbotAccount;
  groupId: string;
  chunks: TimbotTimStreamChunk[];
  compatibleText?: string;
  streamMsgId?: string;
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; streamMsgId?: string; error?: string }> {
  const {
    account,
    groupId,
    chunks,
    compatibleText,
    streamMsgId,
    fromAccount,
    target,
  } = params;

  const warn = (msg: string) => target ? log(target, "warn", msg) : logSimple("warn", msg);
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  if (!account.configured) {
    warn("发送群流式消息失败: 账号未配置");
    return { ok: false, error: "account not configured" };
  }

  if (!account.sdkAppId || !account.secretKey) {
    const missing: string[] = [];
    if (!account.sdkAppId) missing.push("sdkAppId");
    if (!account.secretKey) missing.push("secretKey");
    error(`发送群流式消息失败: 缺少必需参数: ${missing.join(", ")}`);
    return { ok: false, error: `missing required params: ${missing.join(", ")}` };
  }

  const url = buildTimbotApiUrl(account, "stream_msg", "send_group_stream_msg");
  const msgRandom = Math.floor(Math.random() * 4294967295);
  const body: Record<string, unknown> = {
    GroupId: groupId,
    Random: msgRandom,
    MsgBody: buildTimStreamMsgBody({
      chunks,
      compatibleText,
      streamMsgId,
    }),
  };

  if (fromAccount) {
    body.From_Account = fromAccount;
  }

  verbose(`群流式消息请求 URL: ${url}`);
  verbose(`群流式消息请求 Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    verbose(`群流式消息 HTTP 响应状态: ${response.status} ${response.statusText}`);
    const resultText = await response.text();
    verbose(`群流式消息响应内容: ${resultText}`);
    let result: TimbotSendMsgResponse;
    try {
      result = JSON.parse(resultText) as TimbotSendMsgResponse;
    } catch {
      error("群流式消息响应解析失败，非 JSON 格式");
      return { ok: false, error: `Invalid response: ${resultText.slice(0, 200)}` };
    }
    if (result.ActionStatus !== "OK") {
      error(`群流式消息发送失败: ErrorCode=${result.ErrorCode}, ErrorInfo=${result.ErrorInfo}`);
      return { ok: false, error: result.ErrorInfo || `ErrorCode: ${result.ErrorCode}` };
    }
    return { ok: true, streamMsgId: result.StreamMsgID?.trim() || streamMsgId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`群流式消息发送异常: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

// ============ 消息修改 API ============

async function modifyC2CMsg(params: {
  account: ResolvedTimbotAccount;
  fromAccount: string;
  toAccount: string;
  msgKey: string;
  msgBody: TimbotMsgBodyElement[];
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; error?: string }> {
  const { account, fromAccount, toAccount, msgKey, msgBody, target } = params;
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  const url = buildTimbotApiUrl(account, "openim", "modify_c2c_msg");
  const body = {
    From_Account: fromAccount,
    To_Account: toAccount,
    MsgKey: msgKey,
    MsgBody: msgBody,
  };

  verbose(`C2C 消息修改请求 URL: ${url}`);
  verbose(`C2C 消息修改请求 Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    verbose(`C2C 消息修改 HTTP 响应状态: ${response.status} ${response.statusText}`);
    const resultText = await response.text();
    verbose(`C2C 消息修改响应内容: ${resultText}`);
    let result: TimbotSendMsgResponse;
    try {
      result = JSON.parse(resultText) as TimbotSendMsgResponse;
    } catch {
      error("C2C 消息修改响应解析失败，非 JSON 格式");
      return { ok: false, error: `Invalid response: ${resultText.slice(0, 200)}` };
    }
    if (result.ActionStatus !== "OK") {
      error(`C2C 消息修改失败: ErrorCode=${result.ErrorCode}, ErrorInfo=${result.ErrorInfo}`);
      return { ok: false, error: result.ErrorInfo || `ErrorCode: ${result.ErrorCode}` };
    }
    return { ok: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`C2C 消息修改异常: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

async function modifyGroupMsg(params: {
  account: ResolvedTimbotAccount;
  groupId: string;
  msgSeq: number;
  msgBody: TimbotMsgBodyElement[];
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; error?: string }> {
  const { account, groupId, msgSeq, msgBody, target } = params;
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  const url = buildTimbotApiUrl(account, "openim", "modify_group_msg");
  const body = {
    GroupId: groupId,
    MsgSeq: msgSeq,
    MsgBody: msgBody,
  };

  verbose(`群消息修改请求 URL: ${url}`);
  verbose(`群消息修改请求 Body: ${JSON.stringify(body)}`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    verbose(`群消息修改 HTTP 响应状态: ${response.status} ${response.statusText}`);
    const resultText = await response.text();
    verbose(`群消息修改响应内容: ${resultText}`);
    let result: TimbotSendMsgResponse;
    try {
      result = JSON.parse(resultText) as TimbotSendMsgResponse;
    } catch {
      error("群消息修改响应解析失败，非 JSON 格式");
      return { ok: false, error: `Invalid response: ${resultText.slice(0, 200)}` };
    }
    if (result.ActionStatus !== "OK") {
      error(`群消息修改失败: ErrorCode=${result.ErrorCode}, ErrorInfo=${result.ErrorInfo}`);
      return { ok: false, error: result.ErrorInfo || `ErrorCode: ${result.ErrorCode}` };
    }
    return { ok: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    error(`群消息修改异常: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

// ============ 公共流式回复逻辑 ============

async function executeStreamingReply(params: {
  transport: StreamingTransport;
  target: TimbotWebhookTarget;
  account: ResolvedTimbotAccount;
  core: PluginRuntime;
  config: OpenClawConfig;
  ctxPayload: Record<string, unknown>;
  replyRuntime: { config: OpenClawConfig; disableBlockStreaming: boolean };
  tableMode: string;
  splitFinalText: (text: string) => string[];
  streamingMode: ResolvedTimbotAccount["streamingMode"];
  fallbackPolicy: ResolvedTimbotAccount["fallbackPolicy"];
  overflowPolicy: ResolvedTimbotAccount["overflowPolicy"];
  useStreaming: boolean;
  useCustomStreaming: boolean;
  useTimStream: boolean;
  typingText: string;
  hasTypingText: boolean;
}): Promise<void> {
  const {
    transport,
    target,
    account,
    core,
    replyRuntime,
    tableMode,
    splitFinalText,
    streamingMode,
    fallbackPolicy,
    overflowPolicy,
    useStreaming,
    useCustomStreaming,
    useTimStream,
    typingText,
    hasTypingText,
    ctxPayload,
  } = params;

  const L = transport.label;

  logVerbose(
    target,
    `${L}reply streaming path: ${useStreaming ? `partial (throttleMs=${TIMBOT_PARTIAL_STREAM_THROTTLE_MS})` : "final-only"} (streamingMode=${account.streamingMode}, fallbackPolicy=${fallbackPolicy}, overflowPolicy=${overflowPolicy})`,
  );

  let streamMsgRef: StreamingMsgRef | undefined;
  let timStreamMsgId: string | undefined;
  let timStreamNextChunkIndex = 1;
  let timStreamClosed = false;
  let streamFailed = !useStreaming;
  let streamFailureReason: string | undefined;
  let streamOverflowed = false;
  let lastSentVisibleText = "";
  const partialTextAccumulator = createPartialTextAccumulator();
  const streamFallbackTexts: string[] = [];

  let typingMsgRef: StreamingMsgRef | undefined;
  const collectedTexts: string[] = [];
  let assistantMessageStartCount = 0;
  let assistantMessageStartAt: number | undefined;
  let partialReplyCount = 0;
  let firstPartialReplyAt: number | undefined;

  const buildTimStreamRequest = (params: {
    markdown: string;
    isLast: boolean;
    compatibleText?: string;
    streamMsgId?: string;
  }): { chunks: TimbotTimStreamChunk[]; compatibleText?: string; streamMsgId?: string } => ({
    chunks: [
      buildTimStreamChunk({
        index: timStreamNextChunkIndex,
        markdown: params.markdown,
        isLast: params.isLast,
      }),
    ],
    compatibleText: params.compatibleText,
    streamMsgId: params.streamMsgId,
  });

  const estimateTimStreamMsgBodyBytes = (params: {
    markdown: string;
    isLast: boolean;
    compatibleText?: string;
    streamMsgId?: string;
  }): number =>
    estimateMsgBodyBytes(
      buildTimStreamMsgBody(buildTimStreamRequest(params)),
    );

  const resolveTimStreamDelta = (nextText: string): string | undefined => {
    if (!timStreamMsgId || !lastSentVisibleText) {
      return nextText;
    }
    return nextText.startsWith(lastSentVisibleText)
      ? nextText.slice(lastSentVisibleText.length)
      : undefined;
  };

  const sendTimStreamChunk = async (params: {
    markdown: string;
    isLast: boolean;
    compatibleText?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const result = await transport.sendStreamMsg(
      buildTimStreamRequest({
        markdown: params.markdown,
        isLast: params.isLast,
        compatibleText: params.compatibleText,
        streamMsgId: timStreamMsgId,
      }),
    );
    if (result.ok && (timStreamMsgId || result.streamMsgId)) {
      timStreamMsgId = result.streamMsgId ?? timStreamMsgId;
      timStreamNextChunkIndex += 1;
      timStreamClosed = params.isLast;
      return { ok: true };
    }
    return {
      ok: false,
      error:
        result.error
        || (timStreamMsgId ? `${L}流式消息更新失败` : `${L}流式消息未返回 StreamMsgID`),
    };
  };

  const closeTimStream = async (compatibleText: string): Promise<boolean> => {
    if (!timStreamMsgId || timStreamClosed) {
      return true;
    }
    const result = await sendTimStreamChunk({
      markdown: "",
      isLast: true,
      compatibleText,
    });
    return result.ok;
  };

  const sendChunkedFinalText = async (text: string): Promise<boolean> => {
    const chunks = splitFinalText(text).filter((chunk) => chunk.length > 0);
    if (chunks.length === 0) {
      return false;
    }

    if (useTimStream && timStreamMsgId) {
      const closed = await closeTimStream(lastSentVisibleText || typingText);
      if (closed) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
      } else {
        log(target, "warn", `${L}长消息流式收尾失败，继续分段发送`);
      }
    }

    let startIndex = 0;
    if (!useTimStream && streamMsgRef) {
      const firstChunk = chunks[0];
      const firstResult = await transport.modifyMsg({
        ref: streamMsgRef,
        msgBody: buildTextMsgBody(firstChunk),
      });
      if (firstResult.ok) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
        startIndex = 1;
      } else {
        log(target, "warn", `${L}长消息首段修改失败，改为新消息发送: ${firstResult.error}`);
      }
    }

    for (const chunk of chunks.slice(startIndex)) {
      const result = await transport.sendText({ text: chunk });
      if (!result.ok) {
        streamFailureReason = result.error || streamFailureReason || `${L}长消息分段发送失败`;
        return false;
      }
      target.statusSink?.({ lastOutboundAt: Date.now() });
    }

    return true;
  };

  const sendOverflowNotice = async (): Promise<boolean> => {
    if (useTimStream && timStreamMsgId) {
      const closed = await closeTimStream(lastSentVisibleText || typingText);
      if (closed) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
      } else {
        log(target, "warn", `${L}超限后流式收尾失败`);
      }
    } else if (streamMsgRef && !lastSentVisibleText) {
      const replaceResult = await transport.modifyMsg({
        ref: streamMsgRef,
        msgBody: buildTextMsgBody(TIMBOT_OVERFLOW_NOTICE_TEXT),
      });
      if (replaceResult.ok) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
        return true;
      }
      log(target, "warn", `${L}超限提示覆盖占位消息失败: ${replaceResult.error}`);
    } else if (useCustomStreaming && streamMsgRef && lastSentVisibleText) {
      const finalizeResult = await transport.modifyMsg({
        ref: streamMsgRef,
        msgBody: buildSnapshotStreamingMsgBody({
          useCustomStreaming: true,
          text: lastSentVisibleText,
          isFinished: 1,
          typingText,
        }),
      });
      if (finalizeResult.ok) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
      } else {
        log(target, "warn", `${L}超限后 custom_modify 收尾失败: ${finalizeResult.error}`);
      }
    }

    const noticeResult = await transport.sendText({ text: TIMBOT_OVERFLOW_NOTICE_TEXT });
    if (noticeResult.ok) {
      target.statusSink?.({ lastOutboundAt: Date.now() });
      return true;
    }
    log(target, "warn", `${L}超限提示发送失败: ${noticeResult.error}`);
    return false;
  };

  const streamLoop = useStreaming
    ? createLatestTextThrottleLoop({
        throttleMs: TIMBOT_PARTIAL_STREAM_THROTTLE_MS,
        isStopped: () => streamFailed,
        sendLatestText: async (visibleText) => {
          if (!visibleText.trim() || visibleText === lastSentVisibleText) {
            return true;
          }

          if (useTimStream) {
            if (lastSentVisibleText && !visibleText.startsWith(lastSentVisibleText)) {
              streamFailureReason = `${L}流式快照与已发送文本不连续，停止 TIM stream 增量更新`;
              log(target, "warn", streamFailureReason);
              streamFailed = true;
              return false;
            }

            const deltaText = resolveTimStreamDelta(visibleText);
            if (deltaText == null) {
              streamFailureReason = `${L}流式快照与已发送文本不连续，停止 TIM stream 增量更新`;
              log(target, "warn", streamFailureReason);
              streamFailed = true;
              return false;
            }
            if (!deltaText) {
              return true;
            }
            const estimatedBytes = estimateTimStreamMsgBodyBytes({
              markdown: deltaText,
              isLast: false,
              compatibleText: visibleText,
              streamMsgId: timStreamMsgId,
            });
            if (estimatedBytes > TIMBOT_STREAM_SOFT_LIMIT_BYTES) {
              streamOverflowed = true;
              streamFailureReason = `${L}流式消息接近长度上限，停止增量更新并改为最终分段发送 (bytes=${estimatedBytes})`;
              log(target, "warn", streamFailureReason);
              streamFailed = true;
              return false;
            }

            const result = await sendTimStreamChunk({
              markdown: deltaText,
              isLast: false,
              compatibleText: visibleText,
            });

            if (result.ok) {
              lastSentVisibleText = visibleText;
              target.statusSink?.({ lastOutboundAt: Date.now() });
              return true;
            }

            streamFailureReason =
              result.error
              || streamFailureReason
              || (timStreamMsgId ? `${L}流式消息更新失败` : `${L}流式消息未返回 StreamMsgID`);
            if (isMsgTooLongError(result.error)) {
              streamOverflowed = true;
            }
            log(target, "warn", `${L}流式消息发送失败，等待最终收尾: ${streamFailureReason}`);
            streamFailed = true;
            return false;
          }

          const msgBody = buildSnapshotStreamingMsgBody({
            useCustomStreaming,
            text: visibleText,
            isFinished: 0,
            typingText,
          });
          const estimatedBytes = estimateMsgBodyBytes(msgBody);
          if (estimatedBytes > TIMBOT_STREAM_SOFT_LIMIT_BYTES) {
            streamOverflowed = true;
            streamFailureReason = `${L}流式消息接近长度上限，停止 modify 并改为最终分段发送 (bytes=${estimatedBytes})`;
            log(target, "warn", streamFailureReason);
            streamFailed = true;
            return false;
          }

          if (streamMsgRef) {
            const result = await transport.modifyMsg({
              ref: streamMsgRef,
              msgBody,
            });

            if (result.ok) {
              lastSentVisibleText = visibleText;
              target.statusSink?.({ lastOutboundAt: Date.now() });
              return true;
            }

            streamFailureReason = result.error || streamFailureReason || `${L}流式消息更新失败`;
            if (isMsgTooLongError(result.error)) {
              streamOverflowed = true;
            }
            log(target, "warn", `${L}流式消息更新失败，等待最终收尾: ${streamFailureReason}`);
            streamFailed = true;
            return false;
          }

          const result = await transport.sendMsgBody({ msgBody });

          if (result.ok && result.ref) {
            streamMsgRef = result.ref;
            lastSentVisibleText = visibleText;
            target.statusSink?.({ lastOutboundAt: Date.now() });
            return true;
          }

          streamFailureReason = result.error || streamFailureReason || `${L}流式消息创建失败`;
          if (isMsgTooLongError(result.error)) {
            streamOverflowed = true;
          }
          log(target, "warn", `${L}流式消息创建失败，等待最终收尾: ${streamFailureReason}`);
          streamFailed = true;
          return false;
        },
      })
    : undefined;

  // typingText 发送
  if (useStreaming && hasTypingText) {
    if (useTimStream) {
      const typingResult = await sendTimStreamChunk({
        markdown: "",
        isLast: false,
        compatibleText: typingText,
      });
      if (typingResult.ok && timStreamMsgId) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
      } else {
        log(target, "warn", `${L}流式 typingText 发送失败，首块文本到达时再创建消息: ${typingResult.error || "未返回 StreamMsgID"}`);
      }
    } else {
      const typingMsgBody = useCustomStreaming
        ? buildCustomMsgBody(buildBotStreamPayload([], 0, typingText))
        : buildTextMsgBody(typingText);
      const typingResult = await transport.sendMsgBody({ msgBody: typingMsgBody });
      if (typingResult.ok && typingResult.ref) {
        streamMsgRef = typingResult.ref;
        target.statusSink?.({ lastOutboundAt: Date.now() });
      } else {
        log(target, "warn", `${L}流式 typingText 发送失败，首块文本到达时再创建消息: ${typingResult.error}`);
      }
    }
  } else if (!useStreaming && hasTypingText) {
    const typingResult = await transport.sendMsgBody({ msgBody: buildTextMsgBody(typingText) });
    if (typingResult.ok && typingResult.ref) {
      typingMsgRef = typingResult.ref;
    }
  }

  // dispatch 回复
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: replyRuntime.config,
    replyOptions: {
      disableBlockStreaming: replyRuntime.disableBlockStreaming,
      onAssistantMessageStart: useStreaming
        ? () => {
            assistantMessageStartCount += 1;
            assistantMessageStartAt ??= Date.now();
            partialTextAccumulator.noteAssistantMessageStart();
          }
        : undefined,
      onPartialReply: useStreaming
        ? (payload: { text?: string }) => {
            const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode);
            if (!text) {
              return;
            }
            partialReplyCount += 1;
            firstPartialReplyAt ??= Date.now();
            const visibleText = partialTextAccumulator.absorbPartial(text);
            logVerbose(
              target,
              `[partialStream] ${L}snapshot: partialLen=${text.length}, visibleLen=${visibleText.length}, trimEmpty=${!visibleText.trim()}, streamFailed=${streamFailed}, t=${Date.now()}`,
            );
            if (!visibleText.trim()) {
              return;
            }
            streamLoop?.update(visibleText);
          }
        : undefined,
    },
    dispatcherOptions: {
      deliver: async (payload: { text?: string }, info: { kind: string }) => {
        const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode);
        if (useStreaming) {
          logVerbose(
            target,
            `[partialStream] ${L}dispatcher deliver kind=${info.kind}: len=${text.length}, trimEmpty=${!text.trim()}, streamFailed=${streamFailed}, t=${Date.now()}`,
          );
          if (text.trim()) {
            streamFallbackTexts.push(text);
          }
          return;
        }

        if (!text.trim()) {
          return;
        }

        if (typingMsgRef) {
          collectedTexts.push(text);
          return;
        }

        const result = await transport.sendText({ text });
        if (!result.ok) {
          target.runtime.error?.(`[${account.accountId}] timbot ${L}send failed: ${result.error}`);
        } else {
          target.statusSink?.({ lastOutboundAt: Date.now() });
        }
      },
      onError: (err: unknown, info: { kind: string }) => {
        target.runtime.error?.(`[${account.accountId}] timbot ${L}${info.kind} reply failed: ${String(err)}`);
      },
    },
  });

  // 流式收尾
  if (useStreaming) {
    await streamLoop?.flush();
    streamLoop?.stop();
    await streamLoop?.waitForInFlight();
  }

  const streamFallbackText = streamFallbackTexts.join("\n\n");
  const streamVisibleText = partialTextAccumulator.getVisibleText();
  const firstPartialLatencyMs =
    assistantMessageStartAt != null && firstPartialReplyAt != null
      ? Math.max(0, firstPartialReplyAt - assistantMessageStartAt)
      : undefined;

  if (useStreaming) {
    logVerbose(
      target,
      `[partialStream] ${L}summary: assistantStarts=${assistantMessageStartCount}, partialCount=${partialReplyCount}, firstPartialLatencyMs=${firstPartialLatencyMs ?? "n/a"}, visibleLen=${streamVisibleText.length}, fallbackLen=${streamFallbackText.length}, streamFailed=${streamFailed}, overflowed=${streamOverflowed}, t=${Date.now()}`,
    );
  }

  if (
    useStreaming
    && (
      (useTimStream && (timStreamMsgId || streamVisibleText || streamFallbackText))
      || (!useTimStream && (streamMsgRef || streamVisibleText || streamFallbackText))
    )
  ) {
    const fullText = resolveStreamingFinalText(streamVisibleText, streamFallbackText);
    if (assistantMessageStartCount > 0 && partialReplyCount === 0 && fullText.trim()) {
      log(
        target,
        "warn",
        `${L}上游模型未产出可见 partial 文本，本次回复没有中间流式更新，将表现为「占位消息 + 最终收尾」(assistantStarts=${assistantMessageStartCount}, finalTextLen=${fullText.length})。如需确认，请开启 --raw-stream 并检查是否存在 assistant_text_stream/text_delta。`,
      );
    }
    let finalized = false;
    let overflowStopHandled = false;
    const handleOverflow = async (): Promise<boolean> => {
      if (overflowPolicy === "split" && fullText) {
        return sendChunkedFinalText(fullText);
      }
      overflowStopHandled = true;
      return sendOverflowNotice();
    };
    const finalSnapshotMsgBody = !useTimStream
      ? buildSnapshotStreamingMsgBody({
          useCustomStreaming,
          text: fullText,
          isFinished: 1,
          typingText,
        })
      : undefined;
    const finalTimStreamDelta = useTimStream ? resolveTimStreamDelta(fullText) : undefined;
    const finalTimStreamMsgBody = useTimStream
      && finalTimStreamDelta != null
      ? buildTimStreamMsgBody(
          buildTimStreamRequest({
            markdown: finalTimStreamDelta,
            isLast: true,
            compatibleText: fullText || typingText,
            streamMsgId: timStreamMsgId,
          }),
        )
      : undefined;
    if (streamOverflowed && overflowPolicy === "stop") {
      overflowStopHandled = true;
      finalized = await sendOverflowNotice();
    }

    const shouldUseChunkedFinalText = overflowPolicy === "split" && Boolean(fullText) && (
      streamOverflowed
      || (
        useTimStream
          ? estimateMsgBodyBytes(finalTimStreamMsgBody ?? []) > TIMBOT_STREAM_SOFT_LIMIT_BYTES
          : estimateMsgBodyBytes(finalSnapshotMsgBody ?? []) > TIMBOT_STREAM_SOFT_LIMIT_BYTES
      )
    );

    if (!overflowStopHandled && shouldUseChunkedFinalText && fullText) {
      finalized = await sendChunkedFinalText(fullText);
    }

    if (!overflowStopHandled && !finalized && useTimStream) {
      const compatibleFinalText = fullText || typingText;
      if (finalTimStreamDelta == null) {
        streamFailureReason = `${L}流式消息最终文本与已发送内容不连续，无法继续 TIM stream 收尾`;
        log(target, "warn", streamFailureReason);
      } else if (timStreamMsgId) {
        const finalResult = await sendTimStreamChunk({
          markdown: finalTimStreamDelta,
          isLast: true,
          compatibleText: compatibleFinalText,
        });
        if (finalResult.ok) {
          finalized = true;
          target.statusSink?.({ lastOutboundAt: Date.now() });
        } else {
          streamFailureReason = finalResult.error || streamFailureReason || `${L}流式消息最终收尾失败`;
          if (isMsgTooLongError(finalResult.error)) {
            streamOverflowed = true;
            finalized = await handleOverflow();
          }
          if (!finalized) {
            log(target, "warn", `${L}流式消息最终收尾失败: ${streamFailureReason}`);
          }
        }
      } else if (fullText) {
        const startResult = await sendTimStreamChunk({
          markdown: fullText,
          isLast: true,
          compatibleText: fullText,
        });
        if (startResult.ok) {
          finalized = true;
          target.statusSink?.({ lastOutboundAt: Date.now() });
        } else {
          streamFailureReason = startResult.error || streamFailureReason || `${L}流式消息未返回 StreamMsgID`;
          if (isMsgTooLongError(startResult.error)) {
            streamOverflowed = true;
            finalized = await handleOverflow();
          }
          if (!finalized) {
            log(target, "warn", `${L}流式消息最终发送失败: ${streamFailureReason}`);
          }
        }
      }
    } else if (!overflowStopHandled && !finalized) {
      const finalMsgBody = finalSnapshotMsgBody ?? buildSnapshotStreamingMsgBody({
        useCustomStreaming,
        text: fullText,
        isFinished: 1,
        typingText,
      });

      if (streamMsgRef) {
        const finalResult = await transport.modifyMsg({
          ref: streamMsgRef,
          msgBody: finalMsgBody,
        });
        if (finalResult.ok) {
          finalized = true;
          target.statusSink?.({ lastOutboundAt: Date.now() });
        } else {
          streamFailureReason = finalResult.error || streamFailureReason || `${L}流式消息最终收尾失败`;
          if (isMsgTooLongError(finalResult.error)) {
            streamOverflowed = true;
            finalized = await handleOverflow();
          }
          if (!finalized) {
            log(target, "warn", `${L}流式消息最终收尾失败: ${streamFailureReason}`);
          }
        }
      } else if (fullText) {
        const finalSendResult = await transport.sendMsgBody({ msgBody: finalMsgBody });
        if (finalSendResult.ok && finalSendResult.ref) {
          streamMsgRef = finalSendResult.ref;
          finalized = true;
          target.statusSink?.({ lastOutboundAt: Date.now() });
        } else {
          streamFailureReason = finalSendResult.error || streamFailureReason || `${L}流式消息最终发送失败`;
          if (isMsgTooLongError(finalSendResult.error)) {
            streamOverflowed = true;
            finalized = await handleOverflow();
          }
          if (!finalized) {
            log(target, "warn", `${L}流式消息最终发送失败: ${streamFailureReason}`);
          }
        }
      }
    }

    if (!overflowStopHandled && !finalized && fullText && allowsFinalTextRecovery({ streamingMode, fallbackPolicy })) {
      let recovered = false;

      if (streamMsgRef && useCustomStreaming) {
        const recoverResult = await transport.modifyMsg({
          ref: streamMsgRef,
          msgBody: buildTextMsgBody(fullText),
        });
        if (recoverResult.ok) {
          recovered = true;
          target.statusSink?.({ lastOutboundAt: Date.now() });
        } else {
          streamFailureReason = recoverResult.error || streamFailureReason || `${L}流式消息文本恢复失败`;
          log(target, "warn", `${L}流式消息文本恢复失败: ${streamFailureReason}`);
        }
      }

      if (!recovered) {
        if (streamOverflowed) {
          finalized = await handleOverflow();
        } else {
          const fallbackResult = await transport.sendText({ text: fullText });
          if (fallbackResult.ok) {
            finalized = true;
            target.statusSink?.({ lastOutboundAt: Date.now() });
          } else {
            streamFailureReason = fallbackResult.error || streamFailureReason || `${L}流式消息文本兜底失败`;
            if (isMsgTooLongError(fallbackResult.error)) {
              streamOverflowed = true;
              finalized = await handleOverflow();
            }
            if (!finalized) {
              log(target, "warn", `${L}流式消息文本兜底失败: ${streamFailureReason}`);
            }
          }
        }
      } else {
        finalized = true;
      }
    }

    if (!overflowStopHandled && !finalized && !streamOverflowed && useCustomStreaming && streamMsgRef) {
      const errorResult = await transport.modifyMsg({
        ref: streamMsgRef,
        msgBody: buildCustomMsgBody(buildBotErrorPayload(streamFailureReason || "流式消息处理失败")),
      });
      if (errorResult.ok) {
        target.statusSink?.({ lastOutboundAt: Date.now() });
      } else {
        log(target, "warn", `${L}流式错误状态更新失败: ${errorResult.error}`);
      }
    }
  }

  // typingText 占位消息修改为实际回复
  if (typingMsgRef && collectedTexts.length > 0) {
    const fullText = collectedTexts.join("\n\n");
    const modResult = await transport.modifyMsg({
      ref: typingMsgRef,
      msgBody: buildTextMsgBody(fullText),
    });
    if (!modResult.ok) {
      log(target, "warn", `${L}typingText 消息修改失败，发送新消息: ${modResult.error}`);
      await transport.sendText({ text: fullText });
    }
    target.statusSink?.({ lastOutboundAt: Date.now() });
  }
}

// 从 MsgBody 提取文本内容
function extractTextFromMsgBody(msgBody?: Array<{ MsgType: string; MsgContent: { Text?: string } }>): string {
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

// 处理消息并回复
async function processAndReply(params: {
  target: TimbotWebhookTarget;
  msg: TimbotInboundMessage;
}): Promise<void> {
  const { target, msg } = params;
  const core = target.core;
  const config = target.config;
  const account = target.account;

  const fromAccount = msg.From_Account?.trim() || "unknown";
  const outboundSender = resolveOutboundSenderAccount(account);

  if (fromAccount === outboundSender) {
    log(target, "info", `跳过机器人自身消息 <- ${fromAccount}`);
    return;
  }

  const rawBody = extractTextFromMsgBody(msg.MsgBody);

  log(target, "info", `收到消息 <- ${fromAccount}, msgKey: ${msg.MsgKey}`);
  logVerbose(target, `消息内容: ${rawBody.slice(0, 200)}${rawBody.length > 200 ? "..." : ""}`);

  if (!rawBody.trim()) {
    log(target, "warn", "消息内容为空，跳过处理");
    return;
  }

  // 过滤纯占位符消息（如 [custom]、[image] 等），这些通常是系统消息或输入状态
  if (/^\[.+\]$/.test(rawBody.trim())) {
    logVerbose(target, `占位符消息，跳过处理: ${rawBody} (from: ${fromAccount})`);
    return;
  }

  logVerbose(target, `开始处理消息, 账号: ${account.accountId}`);

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "timbot",
    accountId: account.accountId,
    peer: { kind: "dm", id: fromAccount },
  });

  logVerbose(target, `processing message from ${fromAccount}, agentId=${route.agentId}`);

  const fromLabel = `user:${fromAccount}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "TIMBOT",
    from: fromLabel,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `timbot:${fromAccount}`,
    To: `timbot:${account.botAccount || msg.To_Account || "bot"}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: fromLabel,
    SenderName: fromAccount,
    SenderId: fromAccount,
    Provider: "timbot",
    Surface: "timbot",
    MessageSid: msg.MsgKey,
    OriginatingChannel: "timbot",
    OriginatingTo: `timbot:${fromAccount}`,
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err) => {
      target.runtime.error?.(`timbot: failed updating session meta: ${String(err)}`);
    },
  });

  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "timbot",
    accountId: account.accountId,
  });
  const finalTextChunkLimit = core.channel.text.resolveTextChunkLimit(config, "timbot", account.accountId, {
    fallbackLimit: TIMBOT_FINAL_TEXT_CHUNK_LIMIT,
  });
  const splitFinalText = (text: string) => splitTextByFixedLength(text, finalTextChunkLimit);

  logVerbose(target, `开始生成回复 -> ${fromAccount}`);
  logVerbose(target, `转发给 OpenClaw: RawBody=${rawBody.slice(0, 100)}, SessionKey=${ctxPayload.SessionKey}, From=${ctxPayload.From}`);

  // C2C 传输适配器
  const transport: StreamingTransport = {
    label: "",
    sendStreamMsg: (p) =>
      sendTimbotC2CStreamMessage({
        account,
        toAccount: fromAccount,
        fromAccount: outboundSender,
        target,
        ...p,
      }),
    modifyMsg: (p) => {
      const ref = p.ref as { kind: "c2c"; msgKey: string };
      return modifyC2CMsg({
        account,
        fromAccount: outboundSender,
        toAccount: fromAccount,
        msgKey: ref.msgKey,
        msgBody: p.msgBody,
        target,
      });
    },
    sendMsgBody: async (p) => {
      const result = await sendTimbotMessageBody({
        account,
        toAccount: fromAccount,
        msgBody: p.msgBody,
        fromAccount: outboundSender,
        target,
      });
      return {
        ok: result.ok,
        ref: result.messageId ? { kind: "c2c" as const, msgKey: result.messageId } : undefined,
        error: result.error,
      };
    },
    sendText: (p) =>
      sendTimbotMessage({
        account,
        toAccount: fromAccount,
        text: p.text,
        fromAccount: outboundSender,
        target,
      }),
  };

  const streamingMode = account.streamingMode;
  const useStreaming = isStreamingEnabled(streamingMode);
  const replyRuntime = buildReplyRuntimeConfig(config);

  await executeStreamingReply({
    transport,
    target,
    account,
    core,
    config,
    ctxPayload,
    replyRuntime,
    tableMode,
    splitFinalText,
    streamingMode,
    fallbackPolicy: account.fallbackPolicy,
    overflowPolicy: account.overflowPolicy,
    useStreaming,
    useCustomStreaming: isCustomStreamingMode(streamingMode),
    useTimStream: isTimStreamMode(streamingMode),
    typingText: (account.config.typingText ?? "正在思考中...").trim(),
    hasTypingText: Boolean((account.config.typingText ?? "正在思考中...").trim()),
  });

  log(target, "info", `消息处理完成 <- ${fromAccount}`);
}

// 处理群聊消息并回复
async function processGroupAndReply(params: {
  target: TimbotWebhookTarget;
  msg: TimbotInboundMessage;
}): Promise<void> {
  const { target, msg } = params;
  const core = target.core;
  const config = target.config;
  const account = target.account;

  const groupId = msg.GroupId?.trim() || "unknown";
  const fromAccount = msg.From_Account?.trim() || "unknown";
  const outboundSender = resolveOutboundSenderAccount(account);

  if (fromAccount === outboundSender) {
    log(target, "info", `跳过机器人自身消息 <- group:${groupId}, from: ${fromAccount}`);
    return;
  }

  const rawBody = extractTextFromMsgBody(msg.MsgBody);

  log(target, "info", `收到群消息 <- group:${groupId}, from: ${fromAccount}, msgSeq: ${msg.MsgSeq}`);
  logVerbose(target, `群消息内容: ${rawBody.slice(0, 200)}${rawBody.length > 200 ? "..." : ""}`);

  if (!rawBody.trim()) {
    log(target, "warn", "群消息内容为空，跳过处理");
    return;
  }

  if (/^\[.+\]$/.test(rawBody.trim())) {
    logVerbose(target, `群占位符消息，跳过处理: ${rawBody} (group: ${groupId}, from: ${fromAccount})`);
    return;
  }

  logVerbose(target, `开始处理群消息, 账号: ${account.accountId}, group: ${groupId}`);

  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "timbot",
    accountId: account.accountId,
    peer: { kind: "group", id: groupId },
  });

  logVerbose(target, `processing group message from ${fromAccount} in ${groupId}, agentId=${route.agentId}`);

  const groupLabel = `group:${groupId}`;
  const senderLabel = `user:${fromAccount}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });
  const body = core.channel.reply.formatAgentEnvelope({
    channel: "TIMBOT",
    from: groupLabel,
    previousTimestamp,
    envelope: envelopeOptions,
    body: rawBody,
    chatType: "group",
    senderLabel,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: rawBody,
    CommandBody: rawBody,
    From: `timbot:group:${groupId}`,
    To: `timbot:${account.botAccount || msg.To_Account || "bot"}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "group",
    ConversationLabel: groupLabel,
    GroupSubject: msg.GroupName || undefined,
    SenderName: fromAccount,
    SenderId: fromAccount,
    Provider: "timbot",
    Surface: "timbot",
    MessageSid: msg.MsgKey ?? String(msg.MsgSeq ?? ""),
    OriginatingChannel: "timbot",
    OriginatingTo: `timbot:group:${groupId}`,
  });

  await core.channel.session.recordInboundSession({
    storePath,
    sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
    ctx: ctxPayload,
    onRecordError: (err: unknown) => {
      target.runtime.error?.(`timbot: failed updating group session meta: ${String(err)}`);
    },
  });

  const tableMode = core.channel.text.resolveMarkdownTableMode({
    cfg: config,
    channel: "timbot",
    accountId: account.accountId,
  });
  const finalTextChunkLimit = core.channel.text.resolveTextChunkLimit(config, "timbot", account.accountId, {
    fallbackLimit: TIMBOT_FINAL_TEXT_CHUNK_LIMIT,
  });
  const splitFinalText = (text: string) => splitTextByFixedLength(text, finalTextChunkLimit);

  logVerbose(target, `开始生成群回复 -> group:${groupId}`);

  // Group 传输适配器
  const transport: StreamingTransport = {
    label: "群",
    sendStreamMsg: (p) =>
      sendTimbotGroupStreamMessage({
        account,
        groupId,
        fromAccount: outboundSender,
        target,
        ...p,
      }),
    modifyMsg: (p) => {
      const ref = p.ref as { kind: "group"; msgSeq: number };
      return modifyGroupMsg({
        account,
        groupId,
        msgSeq: ref.msgSeq,
        msgBody: p.msgBody,
        target,
      });
    },
    sendMsgBody: async (p) => {
      const result = await sendTimbotGroupMessageBody({
        account,
        groupId,
        msgBody: p.msgBody,
        fromAccount: outboundSender,
        target,
      });
      return {
        ok: result.ok,
        ref: result.msgSeq != null ? { kind: "group" as const, msgSeq: result.msgSeq } : undefined,
        error: result.error,
      };
    },
    sendText: (p) =>
      sendTimbotGroupMessage({
        account,
        groupId,
        text: p.text,
        fromAccount: outboundSender,
        target,
      }),
  };

  const streamingMode = account.streamingMode;
  const useStreaming = isStreamingEnabled(streamingMode);
  const replyRuntime = buildReplyRuntimeConfig(config);

  await executeStreamingReply({
    transport,
    target,
    account,
    core,
    config,
    ctxPayload,
    replyRuntime,
    tableMode,
    splitFinalText,
    streamingMode,
    fallbackPolicy: account.fallbackPolicy,
    overflowPolicy: account.overflowPolicy,
    useStreaming,
    useCustomStreaming: isCustomStreamingMode(streamingMode),
    useTimStream: isTimStreamMode(streamingMode),
    typingText: (account.config.typingText ?? "正在思考中...").trim(),
    hasTypingText: Boolean((account.config.typingText ?? "正在思考中...").trim()),
  });

  log(target, "info", `群消息处理完成 <- group:${groupId}, from: ${fromAccount}`);
}

export function registerTimbotWebhookTarget(target: TimbotWebhookTarget): () => void {
  const key = normalizeWebhookPath(target.path);
  const normalizedTarget = { ...target, path: key };
  const existing = webhookTargets.get(key) ?? [];
  const next = [...existing, normalizedTarget];
  webhookTargets.set(key, next);
  return () => {
    const updated = (webhookTargets.get(key) ?? []).filter((entry) => entry !== normalizedTarget);
    if (updated.length > 0) webhookTargets.set(key, updated);
    else webhookTargets.delete(key);
  };
}

export async function handleTimbotWebhookRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const path = resolvePath(req);
  const targets = webhookTargets.get(path);
  if (!targets || targets.length === 0) return false;

  const firstTarget = targets[0]!;

  // 只处理 POST 请求
  if (req.method !== "POST") {
    logSimple("warn", `收到非 POST 请求: ${req.method} ${path}`);
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  const query = resolveQueryParams(req);
  const sdkAppId = query.get("SdkAppid") ?? query.get("sdkappid") ?? "";
  const sign = query.get("Sign") ?? query.get("sign") ?? "";
  const requestTime = query.get("RequestTime") ?? query.get("requesttime") ?? "";

  logSimple("info", `收到 webhook 请求: ${path}`);

  // 读取请求体
  const bodyResult = await readJsonBody(req, 1024 * 1024);
  if (!bodyResult.ok) {
    logSimple("error", `请求体读取失败: ${bodyResult.error}`);
    res.statusCode = bodyResult.error === "payload too large" ? 413 : 400;
    res.end(bodyResult.error ?? "invalid payload");
    return true;
  }

  const msg = bodyResult.value as TimbotInboundMessage;

  // 根据 SdkAppid 或 To_Account 匹配目标账号
  const target = targets.find((candidate) => {
    if (!candidate.account.configured) return false;
    // 如果 URL 带了 SdkAppid，校验是否匹配
    if (sdkAppId && candidate.account.sdkAppId !== sdkAppId) return false;
    // 如果配置了 botAccount，校验 To_Account 是否匹配
    if (candidate.account.botAccount && msg.To_Account) {
      return candidate.account.botAccount === msg.To_Account;
    }
    return true;
  }) ?? firstTarget;

  if (!target.account.configured) {
    logSimple("warn", `账号 ${target.account.accountId} 未配置，跳过处理`);
    // 即使未配置也返回成功，避免腾讯 IM 重试
    jsonOk(res, { ActionStatus: "OK", ErrorCode: 0, ErrorInfo: "" });
    return true;
  }

  // 签名验证
  if (target.account.token) {
    // 1. 超时校验：RequestTime 与当前时间相差超过 60 秒则拒绝
    const requestTimestamp = parseInt(requestTime, 10);
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(nowTimestamp - requestTimestamp);
    if (isNaN(requestTimestamp) || timeDiff > 60) {
      logSimple("error", `请求超时: RequestTime=${requestTime}, 当前时间=${nowTimestamp}, 差值=${timeDiff}s`);
      res.statusCode = 403;
      res.end("Request timeout");
      return true;
    }

    // 2. 签名校验：sha256(token + requestTime)
    const expectedSign = createHash("sha256")
      .update(target.account.token + requestTime)
      .digest("hex");
    if (
      sign.length !== expectedSign.length
      || !timingSafeEqual(Buffer.from(sign), Buffer.from(expectedSign))
    ) {
      logSimple("error", `签名验证失败: 收到=${sign.slice(0, 16)}..., 预期=${expectedSign.slice(0, 16)}...`);
      res.statusCode = 403;
      res.end("Signature verification failed");
      return true;
    }
  }

  target.statusSink?.({ lastInboundAt: Date.now() });

  const callbackCommand = msg.CallbackCommand ?? "";

  // 立即返回成功响应给腾讯 IM
  jsonOk(res, { ActionStatus: "OK", ErrorCode: 0, ErrorInfo: "" });

  // 只处理机器人消息回调（C2C 单聊 + 群聊）
  const isC2C = callbackCommand === "Bot.OnC2CMessage";
  const isGroup = callbackCommand === "Bot.OnGroupMessage";
  if (!isC2C && !isGroup) {
    logSimple("info", `非 Bot 消息回调，跳过: ${callbackCommand}`);
    return true;
  }

  // 获取运行时并异步处理消息
  let core: PluginRuntime | null = null;
  try {
    core = getTimbotRuntime();
  } catch (err) {
    logSimple("error", `运行时未就绪: ${String(err)}`);
    return true;
  }

  if (core) {
    const enrichedTarget: TimbotWebhookTarget = { ...target, core };
    if (isGroup) {
      processGroupAndReply({ target: enrichedTarget, msg }).catch((err) => {
        target.runtime.error?.(`[${target.account.accountId}] timbot group agent failed: ${String(err)}`);
      });
    } else {
      processAndReply({ target: enrichedTarget, msg }).catch((err) => {
        target.runtime.error?.(`[${target.account.accountId}] timbot agent failed: ${String(err)}`);
      });
    }
  }

  return true;
}
