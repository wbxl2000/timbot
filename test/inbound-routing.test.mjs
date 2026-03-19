import test from "node:test";
import assert from "node:assert/strict";

import {
  extractMentionedBotAccounts,
  selectTimbotWebhookTarget,
} from "../dist/src/inbound-routing.js";

function buildTarget(accountId, botAccount, overrides = {}) {
  return {
    account: {
      accountId,
      configured: true,
      sdkAppId: "1400000000",
      botAccount,
      ...overrides,
    },
  };
}

test("extractMentionedBotAccounts keeps mention order and removes duplicates", () => {
  assert.deepEqual(
    extractMentionedBotAccounts("你好 @RBT#002，顺便也问一下 ＠RBT#003 和 @RBT#002"),
    ["@RBT#002", "@RBT#003"],
  );
});

test("direct messages still prefer To_Account exact match", () => {
  const target = selectTimbotWebhookTarget({
    targets: [
      buildTarget("coder", "@RBT#003"),
      buildTarget("translator", "@RBT#002"),
      buildTarget("default", "@RBT#001"),
    ],
    msg: {
      CallbackCommand: "Bot.OnC2CMessage",
      To_Account: "@RBT#002",
    },
  });

  assert.equal(target?.account.botAccount, "@RBT#002");
});

test("group messages route by mentioned bot account when To_Account is missing", () => {
  const target = selectTimbotWebhookTarget({
    targets: [
      buildTarget("coder", "@RBT#003"),
      buildTarget("translator", "@RBT#002"),
      buildTarget("default", "@RBT#001"),
    ],
    msg: {
      CallbackCommand: "Bot.OnGroupMessage",
      GroupId: "@TGS#demo",
      MsgBody: [
        {
          MsgType: "TIMTextElem",
          MsgContent: {
            Text: "@RBT#002 帮我翻译这句话",
          },
        },
      ],
    },
  });

  assert.equal(target?.account.botAccount, "@RBT#002");
});

test("group messages prefer AtRobots_Account over message text parsing", () => {
  const target = selectTimbotWebhookTarget({
    targets: [
      buildTarget("coder", "@RBT#003"),
      buildTarget("translator", "@RBT#002"),
    ],
    msg: {
      CallbackCommand: "Bot.OnGroupMessage",
      GroupId: "@TGS#demo",
      AtRobots_Account: ["@RBT#003"],
      MsgBody: [
        {
          MsgType: "TIMTextElem",
          MsgContent: {
            Text: "@RBT#002 帮我翻译这句话",
          },
        },
      ],
    },
  });

  assert.equal(target?.account.botAccount, "@RBT#003");
});

test("group messages without a unique bot mention no longer fall back to the first target", () => {
  const target = selectTimbotWebhookTarget({
    targets: [
      buildTarget("coder", "@RBT#003"),
      buildTarget("translator", "@RBT#002"),
      buildTarget("default", "@RBT#001"),
    ],
    msg: {
      CallbackCommand: "Bot.OnGroupMessage",
      GroupId: "@TGS#demo",
      MsgBody: [
        {
          MsgType: "TIMTextElem",
          MsgContent: {
            Text: "大家好",
          },
        },
      ],
    },
  });

  assert.equal(target, undefined);
});

test("a single configured target still handles group messages without explicit mention", () => {
  const target = selectTimbotWebhookTarget({
    targets: [buildTarget("default", "@RBT#001")],
    msg: {
      CallbackCommand: "Bot.OnGroupMessage",
      GroupId: "@TGS#demo",
      MsgBody: [
        {
          MsgType: "TIMTextElem",
          MsgContent: {
            Text: "有人在吗",
          },
        },
      ],
    },
  });

  assert.equal(target?.account.botAccount, "@RBT#001");
});
