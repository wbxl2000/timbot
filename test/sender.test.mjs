import test from "node:test";
import assert from "node:assert/strict";

import { isSelfInboundMessage, resolveOutboundFromAccount } from "../dist/src/sender.js";

test("outbound sender uses botAccount when configured", () => {
  assert.equal(
    resolveOutboundFromAccount({ botAccount: "@RBT#001" }),
    "@RBT#001",
  );
});

test("outbound sender falls back to inbound bot account when config is missing", () => {
  assert.equal(
    resolveOutboundFromAccount({ identifier: "administrator" }, "@RBT#001"),
    "@RBT#001",
  );
});

test("outbound sender is omitted when botAccount is not configured", () => {
  assert.equal(
    resolveOutboundFromAccount({ identifier: "administrator" }),
    undefined,
  );
});

test("self-message detection matches botAccount first", () => {
  assert.equal(
    isSelfInboundMessage({ botAccount: "@RBT#001", identifier: "administrator" }, "@RBT#001"),
    true,
  );
});

test("self-message detection still matches identifier when botAccount is absent", () => {
  assert.equal(
    isSelfInboundMessage({ identifier: "administrator" }, "administrator"),
    true,
  );
});

test("self-message detection also accepts the inbound bot account fallback", () => {
  assert.equal(
    isSelfInboundMessage({ identifier: "administrator" }, "@RBT#001", ["@RBT#001"]),
    true,
  );
});

test("self-message detection falls back to administrator only when nothing is configured", () => {
  assert.equal(
    isSelfInboundMessage({}, "administrator"),
    true,
  );
});

test("self-message detection does not treat normal users as self", () => {
  assert.equal(
    isSelfInboundMessage({ botAccount: "@RBT#001", identifier: "administrator" }, "user_123"),
    false,
  );
});
