import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";

import type { ResolvedTimbotAccount, TimbotInboundMessage, TimbotSendMsgResponse } from "./types.js";
import { getTimbotRuntime } from "./runtime.js";
import { genTestUserSig } from "./debug/GenerateTestUserSig-es.js";
import { LOG_PREFIX, logSimple } from "./logger.js";

export type TimbotRuntimeEnv = {
  log?: (message: string) => void;
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
    console.error(full);
  } else if (level === "warn") {
    console.warn(full);
  } else {
    target.runtime.log?.(full);
    console.log(full);
  }
}

/** verbose 日志（仅在 --verbose 时输出） */
function logVerbose(target: TimbotWebhookTarget, message: string): void {
  const should = target.core.logging?.shouldLogVerbose?.() ?? false;
  if (should) {
    const full = `${LOG_PREFIX} ${message}`;
    target.runtime.log?.(full);
    console.debug(full);
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
  const result = genTestUserSig({
    userID: "administrator",
    SDKAppID: Number(account.sdkAppId),
    SecretKey: account.secretKey,
  });
  return result?.userSig;
}

// 构建腾讯 IM API URL
function buildTimbotApiUrl(account: ResolvedTimbotAccount, action: string): string {
  const domain = account.apiDomain || "console.tim.qq.com";
  const random = Math.floor(Math.random() * 4294967295);
  const userSig = generateUserSig(account) ?? "";
  // 注意：identifier 和 userSig 都需要 URL 编码，因为可能包含特殊字符如 @ # 等
  return `https://${domain}/v4/openim/${action}?sdkappid=${encodeURIComponent(account.sdkAppId ?? "")}&identifier=administrator&usersig=${encodeURIComponent(userSig)}&random=${random}&contenttype=json`;
}

// 发送腾讯 IM 消息
export async function sendTimbotMessage(params: {
  account: ResolvedTimbotAccount;
  toAccount: string;
  text: string;
  fromAccount?: string;
  target?: TimbotWebhookTarget;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { account, toAccount, text, fromAccount, target } = params;

  // 辅助函数：根据是否有 target 选择日志方式
  const info = (msg: string) => target ? log(target, "info", msg) : logSimple("info", msg);
  const warn = (msg: string) => target ? log(target, "warn", msg) : logSimple("warn", msg);
  const error = (msg: string) => target ? log(target, "error", msg) : logSimple("error", msg);
  const verbose = (msg: string) => target ? logVerbose(target, msg) : undefined;

  verbose(`准备发送消息 -> ${toAccount}, 内容长度: ${text.length}`);

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

  const url = buildTimbotApiUrl(account, "sendmsg");
  const msgRandom = Math.floor(Math.random() * 4294967295);

  const body: Record<string, unknown> = {
    SyncOtherMachine: 2, // 不同步到发送方
    To_Account: toAccount,
    MsgRandom: msgRandom,
    MsgBody: [
      {
        MsgType: "TIMTextElem",
        MsgContent: { Text: text.length > 100 ? text.slice(0, 100) + "..." : text },
      },
    ],
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
      body: JSON.stringify({ ...body, MsgBody: [{ MsgType: "TIMTextElem", MsgContent: { Text: text } }] }), // 使用完整文本
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

    if (result.ErrorCode !== 0) {
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
  const rawBody = extractTextFromMsgBody(msg.MsgBody);

  log(target, "info", `收到消息 <- ${fromAccount}, msgKey: ${msg.MsgKey}`);
  logVerbose(target, `消息内容: ${rawBody.slice(0, 200)}${rawBody.length > 200 ? "..." : ""}`);

  if (!rawBody.trim()) {
    log(target, "warn", "消息内容为空，跳过处理");
    return;
  }

  // 过滤纯占位符消息（如 [custom]、[image] 等），这些通常是系统消息或输入状态
  if (/^\[.+\]$/.test(rawBody.trim())) {
    log(target, "warn", `占位符消息，跳过处理: ${rawBody} (from: ${fromAccount})`);
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

  logVerbose(target, `开始生成回复 -> ${fromAccount}`);
  logVerbose(target, `转发给 OpenClaw: RawBody=${rawBody.slice(0, 100)}, SessionKey=${ctxPayload.SessionKey}, From=${ctxPayload.From}`);

  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      deliver: async (payload) => {
        const text = core.channel.text.convertMarkdownTables(payload.text ?? "", tableMode);
        if (!text.trim()) return;

        const result = await sendTimbotMessage({
          account,
          toAccount: fromAccount,
          text,
          fromAccount: account.botAccount,
          target,
        });

        if (!result.ok) {
          target.runtime.error?.(`[${account.accountId}] timbot send failed: ${result.error}`);
        } else {
          target.statusSink?.({ lastOutboundAt: Date.now() });
        }
      },
      onError: (err, info) => {
        target.runtime.error?.(`[${account.accountId}] timbot ${info.kind} reply failed: ${String(err)}`);
      },
    },
  });

  log(target, "info", `消息处理完成 <- ${fromAccount}`);
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
    if (sign !== expectedSign) {
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

  // 只处理机器人消息回调
  if (callbackCommand !== "Bot.OnC2CMessage") {
    logSimple("info", `非 Bot.OnC2CMessage 回调，跳过: ${callbackCommand}`);
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
    processAndReply({ target: enrichedTarget, msg }).catch((err) => {
      target.runtime.error?.(`[${target.account.accountId}] timbot agent failed: ${String(err)}`);
    });
  }

  return true;
}
