import test from "node:test";
import assert from "node:assert/strict";

import { createPartialTextAccumulator, mergeStreamingText } from "../dist/src/stream-text.js";

test("mergeStreamingText can insert a separator when disjoint text arrives", () => {
  assert.equal(
    mergeStreamingText("alpha", "beta", { separatorIfDisjoint: "\n\n" }),
    "alpha\n\nbeta",
  );
});

test("partial text accumulator does not duplicate overlapping snapshots across assistant starts", () => {
  const accumulator = createPartialTextAccumulator();

  assert.equal(accumulator.absorbPartial("alpha"), "alpha");
  accumulator.noteAssistantMessageStart();
  assert.equal(accumulator.absorbPartial("alpha beta"), "alpha\n\nalpha beta");
  accumulator.noteAssistantMessageStart();
  assert.equal(accumulator.absorbPartial("alpha beta gamma"), "alpha\n\nalpha beta\n\nalpha beta gamma");
});

test("partial text accumulator appends disjoint assistant segments with a paragraph break", () => {
  const accumulator = createPartialTextAccumulator();

  assert.equal(accumulator.absorbPartial("alpha"), "alpha");
  accumulator.noteAssistantMessageStart();
  assert.equal(accumulator.absorbPartial("beta"), "alpha\n\nbeta");
});

test("partial text accumulator replaces repeated snapshots from the same assistant message", () => {
  const accumulator = createPartialTextAccumulator();

  assert.equal(accumulator.absorbPartial("alpha"), "alpha");
  assert.equal(accumulator.absorbPartial("alpha beta"), "alpha beta");
  assert.equal(accumulator.absorbPartial("alpha beta"), "alpha beta");
  assert.equal(accumulator.absorbPartial("alpha beta gamma"), "alpha beta gamma");
});

test("partial text accumulator keeps the longer snapshot when a shorter one reappears", () => {
  const accumulator = createPartialTextAccumulator();

  assert.equal(accumulator.absorbPartial("alpha beta gamma"), "alpha beta gamma");
  assert.equal(accumulator.absorbPartial("alpha beta"), "alpha beta gamma");
});
