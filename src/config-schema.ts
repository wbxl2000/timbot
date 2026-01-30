import type { ChannelConfigSchema } from "clawdbot/plugin-sdk";

const dmSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    policy: { type: "string", enum: ["pairing", "allowlist", "open", "disabled"] },
    allowFrom: {
      type: "array",
      items: { oneOf: [{ type: "string" }, { type: "number" }] },
    },
  },
  additionalProperties: false,
};

const accountSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    enabled: { type: "boolean" },
    webhookPath: { type: "string" },
    sdkAppId: { type: "string" },
    identifier: { type: "string" },
    secretKey: { type: "string" },
    botAccount: { type: "string" },
    apiDomain: { type: "string" },
    token: { type: "string" },
    welcomeText: { type: "string" },
    dm: dmSchema,
  },
  additionalProperties: false,
};

export const timbotConfigSchema: ChannelConfigSchema = {
  schema: {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    properties: {
      name: { type: "string" },
      enabled: { type: "boolean" },
      webhookPath: { type: "string" },
      sdkAppId: { type: "string" },
      identifier: { type: "string" },
      secretKey: { type: "string" },
      botAccount: { type: "string" },
      apiDomain: { type: "string" },
      token: { type: "string" },
      welcomeText: { type: "string" },
      dm: dmSchema,
      defaultAccount: { type: "string" },
      accounts: {
        type: "object",
        additionalProperties: accountSchema,
      },
    },
    additionalProperties: false,
  },
};
