import type {
  TimbotMsgBodyElement,
  TimbotStreamingFallbackPolicy,
  TimbotStreamingMode,
} from "./types.js";

export type TimbotTimStreamChunk = {
  EventType: "data";
  Index: number;
  Markdown: string;
  IsLast: boolean;
};

export const TIMBOT_TIM_STREAM_EVENT_TYPE_DATA = "data";

export type TimbotBotStreamPayload =
  | {
      chatbotPlugin: 2;
      src: 2;
      chunks: string[];
      isFinished: 0 | 1;
      typingText?: string;
    }
  | {
      chatbotPlugin: 2;
      src: 23;
      errorInfo: string;
      isFinished: 1;
    };

export function joinStreamChunks(chunks: string[]): string {
  return chunks.join("");
}

export function buildTextMsgBody(text: string): TimbotMsgBodyElement[] {
  return [
    {
      MsgType: "TIMTextElem",
      MsgContent: { Text: text },
    },
  ];
}

export function buildCustomMsgBody(payload: TimbotBotStreamPayload): TimbotMsgBodyElement[] {
  return [
    {
      MsgType: "TIMCustomElem",
      MsgContent: { Data: JSON.stringify(payload) },
    },
  ];
}

export function buildBotStreamPayload(
  chunks: string[],
  isFinished: 0 | 1,
  typingText?: string,
): TimbotBotStreamPayload {
  const payload: TimbotBotStreamPayload = {
    chatbotPlugin: 2,
    src: 2,
    chunks,
    isFinished,
  };
  const normalizedTypingText = typingText?.trim();
  if (normalizedTypingText && chunks.length === 0 && isFinished !== 1) {
    payload.typingText = normalizedTypingText;
  }
  return payload;
}

export function buildBotErrorPayload(errorInfo: string): TimbotBotStreamPayload {
  return {
    chatbotPlugin: 2,
    src: 23,
    errorInfo,
    isFinished: 1,
  };
}

export function buildTimStreamChunk(params: {
  index: number;
  markdown: string;
  isLast: boolean;
}): TimbotTimStreamChunk {
  return {
    EventType: TIMBOT_TIM_STREAM_EVENT_TYPE_DATA,
    Index: params.index,
    Markdown: params.markdown,
    IsLast: params.isLast,
  };
}

export function buildTimStreamMsgBody(params: {
  chunks: TimbotTimStreamChunk[];
  compatibleText?: string;
  streamMsgId?: string;
}): TimbotMsgBodyElement[] {
  const { chunks, compatibleText, streamMsgId } = params;
  const msgContent: TimbotMsgBodyElement["MsgContent"] = {
    Chunks: chunks.map((chunk) => ({ ...chunk })),
  };
  const normalizedCompatibleText = compatibleText?.trim();
  if (normalizedCompatibleText) {
    msgContent.CompatibleText = normalizedCompatibleText;
  }
  if (streamMsgId?.trim()) {
    msgContent.StreamMsgID = streamMsgId.trim();
  }
  return [
    {
      MsgType: "TIMStreamElem",
      MsgContent: msgContent,
    },
  ];
}

export function buildStreamingMsgBody(params: {
  useCustomStreaming: boolean;
  chunks: string[];
  isFinished: 0 | 1;
  typingText?: string;
}): TimbotMsgBodyElement[] {
  const { useCustomStreaming, chunks, isFinished, typingText } = params;
  if (useCustomStreaming) {
    return buildCustomMsgBody(buildBotStreamPayload([...chunks], isFinished, typingText));
  }
  if (isFinished === 1) {
    return buildTextMsgBody(joinStreamChunks(chunks) || typingText?.trim() || "");
  }
  return buildTextMsgBody(joinStreamChunks(chunks));
}

export function allowsFinalTextRecovery(params: {
  streamingMode: TimbotStreamingMode;
  fallbackPolicy: TimbotStreamingFallbackPolicy;
}): boolean {
  const { streamingMode, fallbackPolicy } = params;
  return streamingMode === "text_modify" || fallbackPolicy === "final_text";
}
