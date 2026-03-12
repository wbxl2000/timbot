export type TimbotDmConfig = {
  policy?: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom?: Array<string | number>;
};

export type TimbotStreamingMode = "off" | "custom_modify" | "text_modify" | "tim_stream";
export type TimbotStreamingFallbackPolicy = "strict" | "final_text";
export type TimbotOverflowPolicy = "stop" | "split";

export type TimbotAccountConfig = {
  name?: string;
  enabled?: boolean;

  webhookPath?: string;
  sdkAppId?: string | number;
  identifier?: string;
  secretKey?: string;
  botAccount?: string;
  apiDomain?: string;
  token?: string;

  dm?: TimbotDmConfig;
  welcomeText?: string;
  typingText?: string;
  streamingMode?: TimbotStreamingMode;
  fallbackPolicy?: TimbotStreamingFallbackPolicy;
  overflowPolicy?: TimbotOverflowPolicy;
};

export type TimbotConfig = TimbotAccountConfig & {
  accounts?: Record<string, TimbotAccountConfig>;
  defaultAccount?: string;
};

export type ResolvedTimbotAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  sdkAppId?: string;
  identifier?: string;
  secretKey?: string;
  botAccount?: string;
  apiDomain: string;
  token?: string;
  streamingMode: TimbotStreamingMode;
  fallbackPolicy: TimbotStreamingFallbackPolicy;
  overflowPolicy: TimbotOverflowPolicy;
  config: TimbotAccountConfig;
};

// 腾讯 IM 消息体元素
export type TimbotMsgBodyElement = {
  MsgType: string;
  MsgContent: {
    Text?: string;
    // 可扩展其他消息类型的字段
    [key: string]: unknown;
  };
};

// 腾讯 IM 入站消息（Webhook 回调）
export type TimbotInboundMessage = {
  CallbackCommand?: string;
  From_Account?: string;
  To_Account?: string;
  GroupId?: string;
  GroupName?: string;
  MsgSeq?: number;
  MsgRandom?: number;
  MsgTime?: number;
  MsgKey?: string;
  MsgId?: string;
  OnlineOnlyFlag?: number;
  SendMsgResult?: number;
  ErrorInfo?: string;
  MsgBody?: TimbotMsgBodyElement[];
  CloudCustomData?: string;
  EventTime?: number;
};

// 腾讯 IM 发送消息请求
export type TimbotSendMsgRequest = {
  SyncOtherMachine?: number;
  From_Account?: string;
  To_Account: string;
  MsgSeq?: number;
  MsgRandom: number;
  MsgBody: TimbotMsgBodyElement[];
  CloudCustomData?: string;
  OfflinePushInfo?: {
    PushFlag?: number;
    Desc?: string;
    Ext?: string;
  };
};

// 腾讯 IM 发送消息响应
export type TimbotSendMsgResponse = {
  ActionStatus: string;
  ErrorCode: number;
  ErrorInfo: string;
  MsgTime?: number;
  MsgKey?: string;
  MsgId?: string;
  MsgSeq?: number;
  StreamMsgID?: string;
};

// 腾讯 IM 群消息发送请求
export type TimbotSendGroupMsgRequest = {
  GroupId: string;
  Random: number;
  MsgBody: TimbotMsgBodyElement[];
  From_Account?: string;
  MsgPriority?: string;
  CloudCustomData?: string;
};
