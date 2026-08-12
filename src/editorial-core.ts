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

const COMMENT_MARKER = "%%";

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/u.test(character);
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{N}_]/u.test(character);
}

function isClosingPunctuation(character: string | undefined): boolean {
  return character !== undefined && /[.,;:!?…\)\]\}”’»]/u.test(character);
}

function isOpeningPunctuation(character: string | undefined): boolean {
  return character !== undefined && /[\(\[\{“‘«]/u.test(character);
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
