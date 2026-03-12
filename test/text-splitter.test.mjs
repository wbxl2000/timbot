import test from "node:test";
import assert from "node:assert/strict";

import { splitTextByPreferredBreaks, takeReadyTextChunks } from "../dist/src/text-splitter.js";

test("splitter returns empty array for empty text", () => {
  assert.deepEqual(splitTextByPreferredBreaks("", 10), []);
});

test("splitter returns original text when under the limit", () => {
  assert.deepEqual(splitTextByPreferredBreaks("hello", 10), ["hello"]);
});

test("splitter returns original text when limit is non-positive", () => {
  assert.deepEqual(splitTextByPreferredBreaks("hello", 0), ["hello"]);
});

test("splitter returns original text when text length equals the limit", () => {
  assert.deepEqual(splitTextByPreferredBreaks("hello", 5), ["hello"]);
});

test("splitter prefers newline boundaries", () => {
  assert.deepEqual(
    splitTextByPreferredBreaks("12345\n67890\nabcde", 10),
    ["12345\n", "67890\n", "abcde"],
  );
});

test("splitter falls back to spaces when no suitable newline exists", () => {
  assert.deepEqual(
    splitTextByPreferredBreaks("alpha beta gamma delta", 10),
    ["alpha beta", "gamma", "delta"],
  );
});

test("splitter hard-cuts when there is no suitable separator", () => {
  assert.deepEqual(
    splitTextByPreferredBreaks("abcdefghijk", 5),
    ["abcde", "fghij", "k"],
  );
});

test("splitter handles large separator-free text without stalling", () => {
  const input = "a".repeat(10001);
  const chunks = splitTextByPreferredBreaks(input, 4096);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [4096, 4096, 1809]);
  assert.equal(chunks.join(""), input);
});

test("splitter matches qqbot trim behavior on subsequent chunks", () => {
  assert.deepEqual(
    splitTextByPreferredBreaks("alpha  beta gamma", 7),
    ["alpha ", "beta", "gamma"],
  );
});

test("splitter repairs fenced code blocks across chunk boundaries", () => {
  const chunks = splitTextByPreferredBreaks(
    "before\n```ts\nconst veryLongIdentifier = 1;\nconst anotherIdentifier = 2;\n```\nafter",
    35,
  );

  assert.ok(chunks.length >= 2);
  for (const chunk of chunks) {
    const fenceMarkers = chunk.match(/^ {0,3}(`{3,}|~{3,})/gm) ?? [];
    assert.equal(fenceMarkers.length % 2, 0);
  }
  assert.ok(chunks.some((chunk) => chunk.endsWith("\n```")));
  assert.ok(chunks.slice(1).some((chunk) => chunk.startsWith("```ts\n")));
});

test("splitter preserves indentation when splitting inside fenced code blocks", () => {
  const chunks = splitTextByPreferredBreaks(
    "```python\nif True:\n    print('a')\n    print('b')\n    print('c')\n```",
    32,
  );

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.slice(1).some((chunk) => chunk.includes("\n    print('")));
});

test("splitter keeps prose outside reopened code fences", () => {
  const chunks = splitTextByPreferredBreaks(
    [
      "```php",
      "<?php",
      "echo 'a very very very very very long line';",
      "echo 'another very very very very very long line';",
      "```",
      "",
      "After prose should stay outside code fences.",
      "",
      "```ts",
      "const value = 1;",
      "const nextValue = 2;",
      "```",
    ].join("\n"),
    60,
  );

  const proseChunk = chunks.find((chunk) => chunk.includes("After prose should stay outside code fences."));
  assert.ok(proseChunk);
  assert.ok(!proseChunk.startsWith("```"));
  assert.ok(!chunks.some((chunk) => /```[a-zA-Z]*\n```/.test(chunk)));
});

test("splitter keeps table rows intact after closing a code fence", () => {
  const chunks = splitTextByPreferredBreaks(
    [
      "```swift",
      "let numbers = [3, 1, 2]",
      "print(numbers.sorted())",
      "```",
      "",
      "| language | style |",
      "| --- | --- |",
      "| Swift | functional |",
      "| Go | in-place |",
    ].join("\n"),
    48,
  );

  const tableChunk = chunks.find((chunk) => chunk.includes("| language | style |"));
  assert.ok(tableChunk);
  assert.ok(!tableChunk.startsWith("```"));
  assert.ok(tableChunk.includes("| --- | --- |"));
});

test("splitter repeats table headers when a table spans multiple chunks", () => {
  const chunks = splitTextByPreferredBreaks(
    [
      "算法总结表",
      "",
      "| 语言 | 风格 | 空间复杂度 | 最佳场景 |",
      "| --- | --- | --- | --- |",
      "| Python | 函数式 | O(n log n) | 教学、原型 |",
      "| JavaScript | 函数式 | O(n log n) | 前端、Node.js |",
      "| Java | 原地排序 | O(log n) | 企业应用 |",
      "| C++ | 原地排序 | O(log n) | 高性能系统 |",
    ].join("\n"),
    120,
  );

  const tableChunks = chunks.filter((chunk) => chunk.includes("| Python |") || chunk.includes("| JavaScript |") || chunk.includes("| Java |") || chunk.includes("| C++ |"));
  assert.ok(tableChunks.length >= 2);
  for (const chunk of tableChunks) {
    assert.ok(chunk.includes("| 语言 | 风格 | 空间复杂度 | 最佳场景 |"));
    assert.ok(chunk.includes("| --- | --- | --- | --- |"));
  }
  assert.ok(chunks.some((chunk) => chunk.includes("| JavaScript | 函数式 | O(n log n) | 前端、Node.js |")));
  assert.ok(chunks.some((chunk) => chunk.includes("| C++ | 原地排序 | O(log n) | 高性能系统 |")));
});

test("splitter keeps table follow-up prose outside stray code fences", () => {
  const chunks = splitTextByPreferredBreaks(
    [
      "```swift",
      "func quicksort(_ arr: [Int]) -> [Int] {",
      "  return arr",
      "}",
      "```",
      "",
      "**详细讲解：**",
      "",
      "Swift 版本的快速排序展现了 Apple 生态系统中现代编程语言的设计美学。",
      "",
      "算法总结表",
      "",
      "| 语言 | 风格 | 空间复杂度 | 最佳场景 |",
      "| --- | --- | --- | --- |",
      "| Python | 函数式 | O(n log n) | 教学、原型 |",
      "| JavaScript | 函数式 | O(n log n) | 前端、Node.js |",
      "| Java | 原地排序 | O(log n) | 企业应用 |",
      "| C++ | 原地排序 | O(log n) | 高性能系统 |",
      "| Go | 原地排序 | O(log n) | 后端服务 |",
      "| Rust | 原地排序 | O(log n) | 系统编程 |",
      "| C# | 原地排序 | O(log n) | .NET 应用 |",
      "| Ruby | 函数式 | O(n log n) | Web 开发 |",
      "| PHP | 函数式 | O(n log n) | 服务器脚本 |",
      "| Swift | 函数式 | O(n log n) | iOS/macOS |",
      "",
      "**时间复杂度：** 平均 O(n log n)，最坏 O(n²)",
      "**稳定性：** 不稳定排序",
    ].join("\n"),
    320,
  );

  const followUpChunk = chunks.find((chunk) => chunk.includes("**时间复杂度：**"));
  assert.ok(followUpChunk);
  assert.ok(!followUpChunk.startsWith("```"));
  assert.ok(chunks.some((chunk) => chunk.includes("| Swift | 函数式 | O(n log n) | iOS/macOS |")));
});

test("takeReadyTextChunks emits completed chunks and keeps the tail buffered", () => {
  assert.deepEqual(
    takeReadyTextChunks("12345\n67890\nabcde", 10),
    {
      readyChunks: ["12345\n", "67890\n"],
      pendingText: "abcde",
    },
  );
});

test("takeReadyTextChunks can advance incrementally without re-emitting prior chunks", () => {
  let pendingText = "";
  const delivered = [];

  for (const piece of ["12345\n67890", "\nabcde\nfghij"]) {
    const next = takeReadyTextChunks(`${pendingText}${piece}`, 10);
    delivered.push(...next.readyChunks);
    pendingText = next.pendingText;
  }

  assert.deepEqual(delivered, ["12345\n", "67890\n", "abcde\n"]);
  assert.equal(pendingText, "fghij");
});

test("splitter keeps completed chunk boundaries stable as the source text grows", () => {
  const input = [
    "# 快速排序合集",
    "",
    "这里是一段很长的说明文字。".repeat(120),
    "",
    "```ts",
    ...Array.from({ length: 90 }, (_, index) => `console.log(${index});`),
    "```",
    "",
    "| 语言 | 风格 | 空间复杂度 | 最佳场景 |",
    "| --- | --- | --- | --- |",
    ...Array.from({ length: 24 }, (_, index) => `| Lang ${index} | in-place | O(log n) | case ${index} |`),
    "",
    "结尾说明。".repeat(80),
  ].join("\n");

  const limit = 320;
  let delivered = [];

  for (let length = 200; length < input.length; length += 137) {
    const { readyChunks } = takeReadyTextChunks(input.slice(0, length), limit);
    assert.deepEqual(readyChunks.slice(0, delivered.length), delivered);
    delivered = readyChunks;
  }
});

test("splitter keeps ordered list numbering continuous across chunk boundaries", () => {
  const chunks = splitTextByPreferredBreaks(
    [
      `1. 第一项 ${"a".repeat(120)}`,
      "",
      `1. 第二项 ${"b".repeat(120)}`,
      "",
      `1. 第三项 ${"c".repeat(120)}`,
    ].join("\n"),
    180,
  );

  assert.equal(chunks.length, 3);
  assert.match(chunks[0], /^1\. /);
  assert.match(chunks[1], /^2\. /);
  assert.match(chunks[2], /^3\. /);
});
