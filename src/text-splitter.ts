type FenceState = {
  marker: string;
  opener: string;
};

type TableState = {
  header: string;
  separator: string;
};

type OrderedListState = {
  indent: string;
  marker: "." | ")";
  nextNumber: number;
};

function stripTrailingNewline(line: string): string {
  return line.replace(/\n$/, "");
}

function isMarkdownTableRow(line: string): boolean {
  const normalizedLine = stripTrailingNewline(line).trim();
  return /^\|.*\|\s*$/.test(normalizedLine);
}

function isMarkdownTableSeparator(line: string): boolean {
  const normalizedLine = stripTrailingNewline(line).trim();
  return /^\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|\s*$/.test(normalizedLine);
}

function splitLooseText(text: string, limit: number, trimLeading: boolean): string[] {
  if (!text) {
    return [];
  }

  if (limit <= 0 || text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt <= 0 || splitAt < limit * 0.5) {
      splitAt = remaining.lastIndexOf(" ", limit);
    }
    if (splitAt <= 0 || splitAt < limit * 0.5) {
      splitAt = limit;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = trimLeading
      ? remaining.slice(splitAt).trimStart()
      : remaining.slice(splitAt);
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function resolveFenceState(line: string, openFence: FenceState | undefined): FenceState | undefined {
  const normalizedLine = line.replace(/\n$/, "");
  const match = normalizedLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) {
    return openFence;
  }

  const marker = match[1];
  const suffix = match[2] ?? "";
  if (openFence) {
    if (
      marker[0] === openFence.marker[0]
      && marker.length >= openFence.marker.length
      && !suffix.trim()
    ) {
      return undefined;
    }
    return openFence;
  }

  return {
    marker,
    opener: normalizedLine,
  };
}

function buildFenceCloseSuffix(openFence: FenceState, chunk: string): string {
  return chunk.endsWith("\n") ? openFence.marker : `\n${openFence.marker}`;
}

function buildFenceReopenPrefix(openFence: FenceState): string {
  return `${openFence.opener}\n`;
}

function renumberOrderedListChunks(chunks: string[]): string[] {
  const orderedItemPattern = /^(\s{0,3})(\d+)([.)])(\s+)/;
  let carryState: OrderedListState | undefined;

  return chunks.map((chunk) => {
    const lines = chunk.match(/[^\n]*\n|[^\n]+/g) ?? [];
    let activeState = carryState;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineWithoutNewline = line.replace(/\n$/, "");
      const orderedMatch = lineWithoutNewline.match(orderedItemPattern);

      if (orderedMatch) {
        const [, indent, rawNumber, marker, spacing] = orderedMatch;
        const normalizedMarker = marker as "." | ")";
        if (
          activeState
          && activeState.indent === indent
          && activeState.marker === normalizedMarker
        ) {
          const expected = activeState.nextNumber;
          lines[index] = line.replace(
            orderedItemPattern,
            `${indent}${expected}${normalizedMarker}${spacing}`,
          );
          activeState = {
            indent,
            marker: normalizedMarker,
            nextNumber: expected + 1,
          };
        } else {
          activeState = {
            indent,
            marker: normalizedMarker,
            nextNumber: Number(rawNumber) + 1,
          };
        }
        continue;
      }

      if (!lineWithoutNewline.trim()) {
        continue;
      }

      if (activeState) {
        const leadingSpaces = lineWithoutNewline.match(/^ */)?.[0].length ?? 0;
        if (leadingSpaces > activeState.indent.length) {
          continue;
        }
      }

      activeState = undefined;
    }

    carryState = activeState;
    return lines.join("");
  });
}

// Prefer qqbot-style soft breaks, but keep fenced code blocks valid by
// splitting on line boundaries first and only reopening fences at chunk
// boundaries when we are actually inside one.
export function splitTextByPreferredBreaks(text: string, limit: number): string[] {
  if (!text) {
    return [];
  }

  if (limit <= 0 || text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.match(/[^\n]*\n|[^\n]+/g) ?? [];
  let openFence: FenceState | undefined;
  let activeTable: TableState | undefined;
  let currentChunk = "";

  const flushCurrentChunk = () => {
    if (!currentChunk) {
      return;
    }
    chunks.push(
      openFence
        ? `${currentChunk}${buildFenceCloseSuffix(openFence, currentChunk)}`
        : currentChunk,
    );
    currentChunk = openFence ? buildFenceReopenPrefix(openFence) : "";
  };

  const canFit = (candidate: string, nextFenceState: FenceState | undefined): boolean => {
    const closeSuffix = nextFenceState ? buildFenceCloseSuffix(nextFenceState, candidate) : "";
    return candidate.length + closeSuffix.length <= limit;
  };

  const isFencePrefixOnly = () => {
    return Boolean(openFence && currentChunk === buildFenceReopenPrefix(openFence));
  };

  const startTableContinuation = () => {
    if (!activeTable) {
      return;
    }
    currentChunk += activeTable.header;
    currentChunk += activeTable.separator;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line) {
      continue;
    }

    if (!openFence && activeTable && !isMarkdownTableRow(line)) {
      activeTable = undefined;
    }

    if (
      !openFence
      && !activeTable
      && isMarkdownTableRow(line)
      && isMarkdownTableSeparator(lines[lineIndex + 1] ?? "")
    ) {
      const header = line;
      const separator = lines[lineIndex + 1] ?? "";
      if (currentChunk && !canFit(`${currentChunk}${header}${separator}`, undefined)) {
        flushCurrentChunk();
      }
      currentChunk += header;
      currentChunk += separator;
      activeTable = { header, separator };
      lineIndex += 1;
      continue;
    }

    if (!openFence && activeTable && isMarkdownTableRow(line)) {
      if (!canFit(`${currentChunk}${line}`, undefined)) {
        flushCurrentChunk();
        startTableContinuation();
      }

      if (!canFit(`${currentChunk}${line}`, undefined)) {
        const availableLength = Math.max(1, limit - currentChunk.length);
        const pieces = splitLooseText(line, availableLength, true);
        for (let index = 0; index < pieces.length; index += 1) {
          const piece = pieces[index];
          currentChunk += piece;
          if (index < pieces.length - 1) {
            flushCurrentChunk();
            startTableContinuation();
          }
        }
      } else {
        currentChunk += line;
      }
      continue;
    }

    const nextFenceState = resolveFenceState(line, openFence);
    if (currentChunk && isFencePrefixOnly() && openFence && nextFenceState == null) {
      currentChunk = "";
      openFence = undefined;
      continue;
    }
    if (!openFence && nextFenceState && currentChunk) {
      flushCurrentChunk();
    }
    if (canFit(`${currentChunk}${line}`, nextFenceState)) {
      currentChunk += line;
      openFence = nextFenceState;
      continue;
    }

    if (currentChunk && !isFencePrefixOnly()) {
      flushCurrentChunk();
    }

    const maxPieceLength = Math.max(
      1,
      limit
        - currentChunk.length
        - (openFence ? openFence.marker.length + 1 : 0),
    );
    const pieces = splitLooseText(line, maxPieceLength, !openFence);

    for (let index = 0; index < pieces.length; index += 1) {
      const piece = pieces[index];
      const pieceFenceState = resolveFenceState(piece, openFence);

      if (!canFit(`${currentChunk}${piece}`, pieceFenceState) && currentChunk) {
        flushCurrentChunk();
      }

      currentChunk += piece;
      openFence = pieceFenceState;

      if (index < pieces.length - 1) {
        flushCurrentChunk();
      }
    }
  }

  if (currentChunk) {
    chunks.push(
      openFence
        ? `${currentChunk}${buildFenceCloseSuffix(openFence, currentChunk)}`
        : currentChunk,
    );
  }

  return renumberOrderedListChunks(chunks.filter((chunk) => chunk.length > 0));
}

export function takeReadyTextChunks(
  text: string,
  limit: number,
): { readyChunks: string[]; pendingText: string } {
  const chunks = splitTextByPreferredBreaks(text, limit).filter((chunk) => chunk.length > 0);
  if (chunks.length <= 1) {
    return {
      readyChunks: [],
      pendingText: chunks[0] ?? "",
    };
  }

  return {
    readyChunks: chunks.slice(0, -1),
    pendingText: chunks.at(-1) ?? "",
  };
}
