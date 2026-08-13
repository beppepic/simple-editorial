export interface TextEdit {
  from: number;
  to: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
}

export interface CommentBodyRange {
  markerFrom: number;
  bodyFrom: number;
  bodyTo: number;
  markerTo: number;
}

export type CommentInputPlan =
  | { kind: "pass" }
  | { kind: "insert"; edit: TextEdit };

export type ToggleCommentPlan =
  | { kind: "apply" | "remove"; edit: TextEdit }
  | { kind: "blocked" };

const COMMENT_MARKER = "%%";

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/u.test(character);
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

function isClosingPunctuation(character: string | undefined): boolean {
  return character !== undefined && /[.,;:!?…)\]}”’»]/u.test(character);
}

function isOpeningPunctuation(character: string | undefined): boolean {
  return character !== undefined && /[([{“‘«]/u.test(character);
}

function findWordRangeAt(
  document: string,
  position: number,
): { from: number; to: number } | null {
  if (
    !isWordCharacter(document[position - 1]) ||
    !isWordCharacter(document[position])
  ) {
    return null;
  }

  let from = position;
  let to = position;
  while (from > 0 && isWordCharacter(document[from - 1])) from -= 1;
  while (to < document.length && isWordCharacter(document[to])) to += 1;
  return { from, to };
}

export function findCommentRanges(document: string): CommentBodyRange[] {
  const ranges: CommentBodyRange[] = [];
  let opening = -1;
  let searchFrom = 0;

  while (searchFrom < document.length) {
    const marker = document.indexOf(COMMENT_MARKER, searchFrom);
    if (marker === -1) break;

    if (opening === -1) {
      opening = marker;
    } else {
      ranges.push({
        markerFrom: opening,
        bodyFrom: opening + COMMENT_MARKER.length,
        bodyTo: marker,
        markerTo: marker + COMMENT_MARKER.length,
      });
      opening = -1;
    }

    searchFrom = marker + COMMENT_MARKER.length;
  }

  return ranges;
}

export function findCommentBodyAt(
  document: string,
  from: number,
  to = from,
): CommentBodyRange | null {
  return (
    findCommentRanges(document).find(
      (range) => from >= range.bodyFrom && to <= range.bodyTo,
    ) ?? null
  );
}

export function isRangeInsideCommentBody(
  document: string,
  from: number,
  to = from,
): boolean {
  return findCommentBodyAt(document, from, to) !== null;
}

function outerSpacing(document: string, position: number): {
  before: string;
  after: string;
} {
  const previous = position > 0 ? document[position - 1] : undefined;
  const next = position < document.length ? document[position] : undefined;

  if (isWordCharacter(previous) && isWordCharacter(next)) {
    return { before: "", after: "" };
  }

  const before =
    previous === undefined || isWhitespace(previous) || isOpeningPunctuation(previous)
      ? ""
      : " ";
  const after =
    next === undefined || isWhitespace(next) || isClosingPunctuation(next)
      ? ""
      : " ";

  return { before, after };
}

export function buildCommentEdit(
  document: string,
  position: number,
  text: string,
): TextEdit {
  const spacing = outerSpacing(document, position);
  const prefix = `${spacing.before}${COMMENT_MARKER} `;
  const suffix = ` ${COMMENT_MARKER}${spacing.after}`;
  const insert = `${prefix}${text}${suffix}`;
  const cursor = position + prefix.length + text.length;

  return {
    from: position,
    to: position,
    insert,
    selectionFrom: cursor,
    selectionTo: cursor,
  };
}

function unwrapCommentEdit(
  document: string,
  range: CommentBodyRange,
  from: number,
  to: number,
): TextEdit {
  const body = document.slice(range.bodyFrom, range.bodyTo);
  const leadingSpace = body.startsWith(" ") ? 1 : 0;
  const trailingSpace = body.endsWith(" ") && body.length > leadingSpace ? 1 : 0;
  const content = body.slice(leadingSpace, body.length - trailingSpace);
  const contentFrom = range.bodyFrom + leadingSpace;
  let editFrom = range.markerFrom;
  let editTo = range.markerTo;

  if (content.length === 0) {
    const previous = document[editFrom - 1];
    const next = document[editTo];
    if (previous === " " && next === " ") {
      editTo += 1;
    } else if (previous === " ") {
      editFrom -= 1;
    } else if (next === " ") {
      editTo += 1;
    }
  }

  const mapPosition = (position: number): number =>
    editFrom +
    Math.max(0, Math.min(content.length, position - contentFrom));

  return {
    from: editFrom,
    to: editTo,
    insert: content,
    selectionFrom: mapPosition(from),
    selectionTo: mapPosition(to),
  };
}

export function planToggleComment(
  document: string,
  from: number,
  to = from,
): ToggleCommentPlan {
  const ranges = findCommentRanges(document);
  const enclosing = ranges.find((range) =>
    from === to
      ? from >= range.markerFrom && from <= range.markerTo
      : from >= range.markerFrom && to <= range.markerTo,
  );

  if (enclosing) {
    return {
      kind: "remove",
      edit: unwrapCommentEdit(document, enclosing, from, to),
    };
  }

  const overlapsComment = ranges.some(
    (range) => from < range.markerTo && to > range.markerFrom,
  );
  if (overlapsComment) return { kind: "blocked" };

  if (from === to) {
    const wordRange = findWordRangeAt(document, from);
    if (wordRange) {
      const selectedText = document.slice(wordRange.from, wordRange.to);
      const prefix = `${COMMENT_MARKER} `;
      const suffix = ` ${COMMENT_MARKER}`;
      const cursor = wordRange.from + prefix.length + selectedText.length;
      return {
        kind: "apply",
        edit: {
          from: wordRange.from,
          to: wordRange.to,
          insert: `${prefix}${selectedText}${suffix}`,
          selectionFrom: cursor,
          selectionTo: cursor,
        },
      };
    }

    return { kind: "apply", edit: buildCommentEdit(document, from, "") };
  }

  const selectedText = document.slice(from, to);
  const prefix = `${COMMENT_MARKER} `;
  const suffix = ` ${COMMENT_MARKER}`;
  return {
    kind: "apply",
    edit: {
      from,
      to,
      insert: `${prefix}${selectedText}${suffix}`,
      selectionFrom: from + prefix.length,
      selectionTo: from + prefix.length + selectedText.length,
    },
  };
}

export function planCommentModeInput(
  document: string,
  from: number,
  to: number,
  text: string,
): CommentInputPlan {
  if (isRangeInsideCommentBody(document, from, to)) {
    return { kind: "pass" };
  }

  if (from !== to || text.trim().length === 0) {
    return { kind: "pass" };
  }

  return { kind: "insert", edit: buildCommentEdit(document, from, text) };
}
