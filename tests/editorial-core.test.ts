import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import {
  buildCommentEdit,
  findCommentBodyAt,
  planCommentModeInput,
} from "../src/editorial-core";
import { protectEditorSelection } from "../src/ui-events";

function applyEdit(document: string, edit: { from: number; to: number; insert: string }): string {
  return document.slice(0, edit.from) + edit.insert + document.slice(edit.to);
}

test("inserts a comment between sentences with natural spacing", () => {
  const document = "pizza. Nils jumped onto the chair.";
  const edit = buildCommentEdit(document, 7, "Check transition");
  assert.equal(
    applyEdit(document, edit),
    "pizza. %% Check transition %% Nils jumped onto the chair.",
  );
});

test("does not add trailing whitespace at the end of a line", () => {
  const document = "pizza.";
  const edit = buildCommentEdit(document, document.length, "Check");
  assert.equal(applyEdit(document, edit), "pizza. %% Check %%");
});

test("does not insert a space before punctuation", () => {
  const document = "This works, mostly.";
  const position = document.indexOf(",");
  const edit = buildCommentEdit(document, position, "Too vague");
  assert.equal(applyEdit(document, edit), "This works %% Too vague %%, mostly.");
});

test("preserves a word when inserting a comment inside it", () => {
  const document = "manuscript";
  const edit = buildCommentEdit(document, 4, "word choice");
  assert.equal(applyEdit(document, edit), "manu%% word choice %%script");
});

test("finds single-line and multiline comment bodies", () => {
  const document = "Before %% first\nsecond %% after";
  const inside = document.indexOf("second") + 2;
  const range = findCommentBodyAt(document, inside);
  assert.ok(range);
  assert.equal(document.slice(range.bodyFrom, range.bodyTo), " first\nsecond ");
  assert.equal(findCommentBodyAt(document, 1), null);
});

test("Comment Mode passes input inside an existing comment", () => {
  const document = "Before %% note %% after";
  const position = document.indexOf("note") + 2;
  assert.deepEqual(planCommentModeInput(document, position, position, "x"), {
    kind: "pass",
  });
});

test("Comment Mode leaves manuscript selection replacement to Obsidian", () => {
  const document = "manuscript";
  assert.deepEqual(planCommentModeInput(document, 0, 4, "note"), {
    kind: "pass",
  });
});

test("Comment Mode leaves whitespace-only input to Obsidian", () => {
  assert.deepEqual(planCommentModeInput("manuscript", 3, 3, "\n"), {
    kind: "pass",
  });
});

test("Comment Mode wraps the first input outside comments", () => {
  const document = "Before. After.";
  const position = document.indexOf("After");
  const plan = planCommentModeInput(document, position, position, "Check");
  assert.equal(plan.kind, "insert");
  if (plan.kind === "insert") {
    assert.equal(applyEdit(document, plan.edit), "Before. %% Check %% After.");
  }
});

test("CodeMirror classifies composition as typing and paste as non-typing", () => {
  const state = EditorState.create({ doc: "Text" });
  const composition = state.update({
    changes: { from: 4, insert: "o" },
    userEvent: "input.type.compose",
  });
  const paste = state.update({
    changes: { from: 4, insert: "pasted" },
    userEvent: "input.paste",
  });

  assert.equal(composition.isUserEvent("input.type"), true);
  assert.equal(paste.isUserEvent("input.type"), false);
});

test("toolbar pointer events do not reach the editor", () => {
  let defaultPrevented = false;
  let propagationStopped = false;

  protectEditorSelection({
    preventDefault: () => {
      defaultPrevented = true;
    },
    stopPropagation: () => {
      propagationStopped = true;
    },
  });

  assert.equal(defaultPrevented, true);
  assert.equal(propagationStopped, true);
});
