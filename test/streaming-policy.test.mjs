import test from "node:test";
import assert from "node:assert/strict";

import {
  allowsFinalTextRecovery,
  buildBotStreamPayload,
  buildStreamingMsgBody,
  buildTimStreamChunk,
  buildTimStreamMsgBody,
} from "../dist/src/streaming-policy.js";

function parseCustomData(msgBody) {
  assert.equal(msgBody.length, 1);
  assert.equal(msgBody[0].MsgType, "TIMCustomElem");
  return JSON.parse(msgBody[0].MsgContent.Data);
}

test("custom streaming placeholder keeps typingText before first chunk", () => {
  const msgBody = buildStreamingMsgBody({
    useCustomStreaming: true,
    chunks: [],
    isFinished: 0,
    typingText: "正在思考中...",
  });

  const payload = parseCustomData(msgBody);
  assert.deepEqual(payload, {
    chatbotPlugin: 2,
    src: 2,
    chunks: [],
    isFinished: 0,
    typingText: "正在思考中...",
  });
});

test("custom streaming final payload drops typingText after completion", () => {
  const msgBody = buildStreamingMsgBody({
    useCustomStreaming: true,
    chunks: ["第一行", "\n第二行"],
    isFinished: 1,
    typingText: "正在思考中...",
  });

  const payload = parseCustomData(msgBody);
  assert.deepEqual(payload, {
    chatbotPlugin: 2,
    src: 2,
    chunks: ["第一行", "\n第二行"],
    isFinished: 1,
  });
});

test("text streaming updates always contain the accumulated text", () => {
  const msgBody = buildStreamingMsgBody({
    useCustomStreaming: false,
    chunks: ["你", "好"],
    isFinished: 0,
    typingText: "正在思考中...",
  });

  assert.deepEqual(msgBody, [
    {
      MsgType: "TIMTextElem",
      MsgContent: {
        Text: "你好",
      },
    },
  ]);
});

test("text streaming final message falls back to typingText when no chunk arrived", () => {
  const msgBody = buildStreamingMsgBody({
    useCustomStreaming: false,
    chunks: [],
    isFinished: 1,
    typingText: "正在思考中...",
  });

  assert.deepEqual(msgBody, [
    {
      MsgType: "TIMTextElem",
      MsgContent: {
        Text: "正在思考中...",
      },
    },
  ]);
});

test("typingText is only emitted in custom payload before any chunk arrives", () => {
  assert.deepEqual(buildBotStreamPayload([], 0, "正在思考中..."), {
    chatbotPlugin: 2,
    src: 2,
    chunks: [],
    isFinished: 0,
    typingText: "正在思考中...",
  });

  assert.deepEqual(buildBotStreamPayload(["hi"], 0, "正在思考中..."), {
    chatbotPlugin: 2,
    src: 2,
    chunks: ["hi"],
    isFinished: 0,
  });
});

test("tim_stream payload uses TIMStreamElem and carries compatibility text", () => {
  assert.deepEqual(
    buildTimStreamMsgBody({
      chunks: [buildTimStreamChunk({ index: 1, markdown: "第一段", isLast: false })],
      compatibleText: "第一段",
      streamMsgId: "stream-1",
    }),
    [
      {
        MsgType: "TIMStreamElem",
        MsgContent: {
          Chunks: [
            {
              EventType: "data",
              Index: 1,
              Markdown: "第一段",
              IsLast: false,
            },
          ],
          CompatibleText: "第一段",
          StreamMsgID: "stream-1",
        },
      },
    ],
  );
});

test("strict fallback preserves explicit custom/tim_stream mode while final_text explicitly allows downgrade", () => {
  assert.equal(
    allowsFinalTextRecovery({ streamingMode: "custom_modify", fallbackPolicy: "strict" }),
    false,
  );
  assert.equal(
    allowsFinalTextRecovery({ streamingMode: "custom_modify", fallbackPolicy: "final_text" }),
    true,
  );
  assert.equal(
    allowsFinalTextRecovery({ streamingMode: "text_modify", fallbackPolicy: "strict" }),
    true,
  );
  assert.equal(
    allowsFinalTextRecovery({ streamingMode: "tim_stream", fallbackPolicy: "strict" }),
    false,
  );
  assert.equal(
    allowsFinalTextRecovery({ streamingMode: "tim_stream", fallbackPolicy: "final_text" }),
    true,
  );
});
