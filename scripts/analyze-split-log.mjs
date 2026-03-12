import { createHash } from "node:crypto";
import fs from "node:fs";

const logPath = process.argv[2] ?? "/Users/qilongyu/code/split.txt";
const raw = fs.readFileSync(logPath, "utf8");
const lines = raw.split(/\r?\n/);

const snapshotMetrics = [];
const sendBodies = [];
let splitStartCount = 0;
let summaryLine = "";
let parsedJsonLineCount = 0;

function extractMessageFromLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return { message: "", time: undefined };
  }
  if (!trimmed.startsWith("{")) {
    return { message: trimmed, time: undefined };
  }
  try {
    const parsed = JSON.parse(trimmed);
    parsedJsonLineCount += 1;
    const message = [parsed["1"], parsed["0"]].find((value) => typeof value === "string") ?? "";
    return {
      message,
      time: typeof parsed.time === "string" ? parsed.time : undefined,
    };
  } catch {
    return { message: trimmed, time: undefined };
  }
}

for (const line of lines) {
  const { message, time } = extractMessageFromLine(line);
  if (!message) {
    continue;
  }

  if (message.includes("流式文本达到分段阈值")) {
    splitStartCount += 1;
  }
  if (message.includes("[partialStream] summary:")) {
    summaryLine = time ? `${time} ${message}` : message;
  }

  const snapshotMatch = message.match(/partialLen=(\d+), visibleLen=(\d+)/);
  if (snapshotMatch) {
    snapshotMetrics.push({
      partialLen: Number(snapshotMatch[1]),
      visibleLen: Number(snapshotMatch[2]),
    });
  }

  const bodyIndex = message.indexOf("发送请求 Body: ");
  if (bodyIndex >= 0) {
    const jsonText = message.slice(bodyIndex + "发送请求 Body: ".length);
    try {
      const payload = JSON.parse(jsonText);
      const text = payload?.MsgBody?.[0]?.MsgContent?.Text;
      if (typeof text === "string") {
        const hash = createHash("sha1").update(text).digest("hex").slice(0, 12);
        sendBodies.push({
          hash,
          length: text.length,
          sample: text.replace(/\s+/g, " ").slice(0, 100),
          time,
        });
      }
    } catch {
      // Ignore truncated or non-JSON lines.
    }
  }
}

const maxPartialLen = Math.max(0, ...snapshotMetrics.map((item) => item.partialLen));
const maxVisibleLen = Math.max(0, ...snapshotMetrics.map((item) => item.visibleLen));
const duplicateCounts = new Map();
for (const body of sendBodies) {
  duplicateCounts.set(body.hash, (duplicateCounts.get(body.hash) ?? 0) + 1);
}

const duplicateBodies = sendBodies
  .filter((body, index) => sendBodies.findIndex((candidate) => candidate.hash === body.hash) === index)
  .map((body) => ({
    ...body,
    count: duplicateCounts.get(body.hash) ?? 1,
  }))
  .filter((body) => body.count > 1)
  .sort((a, b) => b.count - a.count || b.length - a.length)
  .slice(0, 12);

const repeatedSequence = [];
for (let index = 1; index < sendBodies.length; index += 1) {
  if (sendBodies[index]?.hash === sendBodies[index - 1]?.hash) {
    repeatedSequence.push({
      index,
      hash: sendBodies[index].hash,
      sample: sendBodies[index].sample,
    });
  }
}

console.log(`log: ${logPath}`);
console.log(`lines: ${lines.length}`);
console.log(`jsonLines: ${parsedJsonLineCount}`);
console.log(`splitStartCount: ${splitStartCount}`);
console.log(`sendBodyCount: ${sendBodies.length}`);
console.log(`maxPartialLen: ${maxPartialLen}`);
console.log(`maxVisibleLen: ${maxVisibleLen}`);
if (maxPartialLen > 0) {
  console.log(`visibleToPartialRatio: ${(maxVisibleLen / maxPartialLen).toFixed(2)}`);
}
if (summaryLine) {
  console.log(`lastSummary: ${summaryLine}`);
}

if (duplicateBodies.length > 0) {
  console.log("\nTop duplicate send bodies:");
  for (const item of duplicateBodies) {
    console.log(`- ${item.hash} x${item.count} len=${item.length} sample=${item.sample}`);
  }
}

if (repeatedSequence.length > 0) {
  console.log("\nImmediate repeated sends:");
  for (const item of repeatedSequence.slice(0, 12)) {
    console.log(`- index=${item.index} hash=${item.hash} sample=${item.sample}`);
  }
}
