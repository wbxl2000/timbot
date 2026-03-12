export function mergeStreamingText(
  previousText: string | undefined,
  nextText: string | undefined,
  options?: { separatorIfDisjoint?: string },
): string {
  const previous = typeof previousText === "string" ? previousText : "";
  const next = typeof nextText === "string" ? nextText : "";
  const separatorIfDisjoint = options?.separatorIfDisjoint ?? "";
  if (!next) {
    return previous;
  }
  if (!previous || next === previous) {
    return next;
  }
  if (next.startsWith(previous)) {
    return next;
  }
  if (previous.startsWith(next)) {
    return previous;
  }
  if (next.includes(previous)) {
    return next;
  }
  if (previous.includes(next)) {
    return previous;
  }

  const maxOverlap = Math.min(previous.length, next.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (previous.slice(-overlap) === next.slice(0, overlap)) {
      return `${previous}${next.slice(overlap)}`;
    }
  }

  return `${previous}${separatorIfDisjoint}${next}`;
}

function resolveDisjointSeparator(previous: string, next: string): string {
  if (!previous || !next) {
    return "";
  }
  if (/\s$/.test(previous) || /^\s/.test(next)) {
    return "";
  }
  return "\n\n";
}

export function createPartialTextAccumulator() {
  let committedText = "";
  let currentMessageSnapshot = "";
  let expectingNewAssistantMessage = false;

  const joinCommittedAndCurrent = () => {
    if (!committedText) {
      return currentMessageSnapshot;
    }
    if (!currentMessageSnapshot) {
      return committedText;
    }
    const separator = resolveDisjointSeparator(committedText, currentMessageSnapshot);
    return `${committedText}${separator}${currentMessageSnapshot}`;
  };

  const commitCurrentMessage = () => {
    if (!currentMessageSnapshot) {
      return;
    }
    if (!committedText) {
      committedText = currentMessageSnapshot;
    } else {
      committedText = `${committedText}${resolveDisjointSeparator(committedText, currentMessageSnapshot)}${currentMessageSnapshot}`;
    }
    currentMessageSnapshot = "";
  };

  return {
    noteAssistantMessageStart: () => {
      commitCurrentMessage();
      expectingNewAssistantMessage = true;
    },
    absorbPartial: (text: string) => {
      if (!text) {
        return joinCommittedAndCurrent();
      }

      if (expectingNewAssistantMessage && !currentMessageSnapshot) {
        currentMessageSnapshot = text;
        expectingNewAssistantMessage = false;
        return joinCommittedAndCurrent();
      }

      // `onPartialReply` delivers the full visible snapshot for the current
      // assistant message. Replacing the current snapshot keeps the text
      // monotonic even if the same partial is emitted repeatedly.
      if (!currentMessageSnapshot || text.startsWith(currentMessageSnapshot) || text.length >= currentMessageSnapshot.length) {
        currentMessageSnapshot = text;
      }
      expectingNewAssistantMessage = false;
      return joinCommittedAndCurrent();
    },
    getVisibleText: () => joinCommittedAndCurrent(),
  };
}
