import test from "node:test";
import assert from "node:assert/strict";

import { resolveTimbotAccount } from "../dist/src/accounts.js";

test("resolveTimbotAccount accepts numeric sdkAppId values from config", () => {
  const account = resolveTimbotAccount({
    cfg: {
      channels: {
        timbot: {
          enabled: true,
          sdkAppId: 1600012345,
          secretKey: "secret-key",
        },
      },
    },
  });

  assert.equal(account.sdkAppId, "1600012345");
  assert.equal(account.configured, true);
});

test("resolveTimbotAccount still trims string sdkAppId values", () => {
  const account = resolveTimbotAccount({
    cfg: {
      channels: {
        timbot: {
          enabled: true,
          sdkAppId: " 1600012345 ",
          secretKey: "secret-key",
        },
      },
    },
  });

  assert.equal(account.sdkAppId, "1600012345");
  assert.equal(account.configured, true);
});

test("resolveTimbotAccount defaults overflowPolicy to split", () => {
  const account = resolveTimbotAccount({
    cfg: {
      channels: {
        timbot: {
          enabled: true,
          sdkAppId: 1600012345,
          secretKey: "secret-key",
        },
      },
    },
  });

  assert.equal(account.overflowPolicy, "split");
});

test("resolveTimbotAccount still respects explicit overflowPolicy stop", () => {
  const account = resolveTimbotAccount({
    cfg: {
      channels: {
        timbot: {
          enabled: true,
          sdkAppId: 1600012345,
          secretKey: "secret-key",
          overflowPolicy: "stop",
        },
      },
    },
  });

  assert.equal(account.overflowPolicy, "stop");
});
