import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { describe, expect, it } from "vitest";

import type { ClawdbotConfig } from "clawdbot/plugin-sdk";

import type { ResolvedWecomAccount } from "./types.js";
import { computeWecomMsgSignature, decryptWecomEncrypted, encryptWecomPlaintext } from "./crypto.js";
import { handleWecomWebhookRequest, registerWecomWebhookTarget } from "./monitor.js";

async function withServer(
  handler: Parameters<typeof createServer>[0],
  fn: (baseUrl: string) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo | null;
  if (!address) throw new Error("missing server address");
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("handleWecomWebhookRequest", () => {
  const token = "test-token";
  const encodingAESKey = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

  it("handles GET url verification", async () => {
    const account: ResolvedWecomAccount = {
      accountId: "default",
      name: "Test",
      enabled: true,
      configured: true,
      token,
      encodingAESKey,
      receiveId: "",
      config: { webhookPath: "/hook", token, encodingAESKey },
    };

    const unregister = registerWecomWebhookTarget({
      account,
      config: {} as ClawdbotConfig,
      runtime: {},
      core: {} as any,
      path: "/hook",
    });

    try {
      await withServer(async (req, res) => {
        const handled = await handleWecomWebhookRequest(req, res);
        if (!handled) {
          res.statusCode = 404;
          res.end("not found");
        }
      }, async (baseUrl) => {
        const timestamp = "13500001234";
        const nonce = "123412323";
        const echostr = encryptWecomPlaintext({
          encodingAESKey,
          receiveId: "",
          plaintext: "ping",
        });
        const msg_signature = computeWecomMsgSignature({ token, timestamp, nonce, encrypt: echostr });
        const response = await fetch(
          `${baseUrl}/hook?msg_signature=${encodeURIComponent(msg_signature)}&timestamp=${encodeURIComponent(timestamp)}&nonce=${encodeURIComponent(nonce)}&echostr=${encodeURIComponent(echostr)}`,
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("ping");
      });
    } finally {
      unregister();
    }
  });

  it("handles POST callback and returns encrypted stream placeholder", async () => {
    const account: ResolvedWecomAccount = {
      accountId: "default",
      name: "Test",
      enabled: true,
      configured: true,
      token,
      encodingAESKey,
      receiveId: "",
      config: { webhookPath: "/hook", token, encodingAESKey },
    };

    const unregister = registerWecomWebhookTarget({
      account,
      config: {} as ClawdbotConfig,
      runtime: {},
      core: {} as any,
      path: "/hook",
    });

    try {
      await withServer(async (req, res) => {
        const handled = await handleWecomWebhookRequest(req, res);
        if (!handled) {
          res.statusCode = 404;
          res.end("not found");
        }
      }, async (baseUrl) => {
        const timestamp = "1700000000";
        const nonce = "nonce";
        const plain = JSON.stringify({
          msgid: "MSGID",
          aibotid: "AIBOTID",
          chattype: "single",
          from: { userid: "USERID" },
          response_url: "RESPONSEURL",
          msgtype: "text",
          text: { content: "hello" },
        });
        const encrypt = encryptWecomPlaintext({ encodingAESKey, receiveId: "", plaintext: plain });
        const msg_signature = computeWecomMsgSignature({ token, timestamp, nonce, encrypt });

        const response = await fetch(
          `${baseUrl}/hook?msg_signature=${encodeURIComponent(msg_signature)}&timestamp=${encodeURIComponent(timestamp)}&nonce=${encodeURIComponent(nonce)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ encrypt }),
          },
        );
        expect(response.status).toBe(200);
        const json = JSON.parse(await response.text()) as any;
        expect(typeof json.encrypt).toBe("string");
        expect(typeof json.msgsignature).toBe("string");
        expect(typeof json.timestamp).toBe("string");
        expect(typeof json.nonce).toBe("string");

        const replyPlain = decryptWecomEncrypted({
          encodingAESKey,
          receiveId: "",
          encrypt: json.encrypt,
        });
        const reply = JSON.parse(replyPlain) as any;
        expect(reply.msgtype).toBe("stream");
        expect(reply.stream?.content).toBe("1");
        expect(reply.stream?.finish).toBe(false);
        expect(typeof reply.stream?.id).toBe("string");
        expect(reply.stream?.id.length).toBeGreaterThan(0);

        const expectedSig = computeWecomMsgSignature({
          token,
          timestamp: String(json.timestamp),
          nonce: String(json.nonce),
          encrypt: String(json.encrypt),
        });
        expect(json.msgsignature).toBe(expectedSig);
      });
    } finally {
      unregister();
    }
  });
});
