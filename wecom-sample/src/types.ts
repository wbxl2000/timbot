export type WecomDmConfig = {
  policy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: Array<string | number>;
};

export type WecomAccountConfig = {
  name?: string;
  enabled?: boolean;

  webhookPath?: string;
  token?: string;
  encodingAESKey?: string;
  receiveId?: string;

  dm?: WecomDmConfig;
  welcomeText?: string;
};

export type WecomConfig = WecomAccountConfig & {
  accounts?: Record<string, WecomAccountConfig>;
  defaultAccount?: string;
};

export type ResolvedWecomAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  token?: string;
  encodingAESKey?: string;
  receiveId: string;
  config: WecomAccountConfig;
};

export type WecomInboundBase = {
  msgid?: string;
  aibotid?: string;
  chattype?: "single" | "group";
  chatid?: string;
  response_url?: string;
  from?: { userid?: string; corpid?: string };
  msgtype?: string;
};

export type WecomInboundText = WecomInboundBase & {
  msgtype: "text";
  text?: { content?: string };
  quote?: unknown;
};

export type WecomInboundVoice = WecomInboundBase & {
  msgtype: "voice";
  voice?: { content?: string };
  quote?: unknown;
};

export type WecomInboundStreamRefresh = WecomInboundBase & {
  msgtype: "stream";
  stream?: { id?: string };
};

export type WecomInboundEvent = WecomInboundBase & {
  msgtype: "event";
  create_time?: number;
  event?: {
    eventtype?: string;
    [key: string]: unknown;
  };
};

export type WecomInboundMessage =
  | WecomInboundText
  | WecomInboundVoice
  | WecomInboundStreamRefresh
  | WecomInboundEvent
  | (WecomInboundBase & Record<string, unknown>);

