import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import {
  buildCommentEdit,
  findCommentBodyAt,
  planCommentModeInput,
  planToggleComment,
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

test("Toggle comment inserts an empty comment at the cursor", () => {
  const document = "Before. After.";
  const position = document.indexOf("After");
  const plan = planToggleComment(document, position);
  assert.equal(plan.kind, "apply");
  if (plan.kind === "apply") {
    assert.equal(applyEdit(document, plan.edit), "Before. %%  %% After.");
    assert.equal(plan.edit.selectionFrom, plan.edit.selectionTo);
  }
});

test("Toggle comment wraps and preserves selected text", () => {
  const document = "Before selected after";
  const from = document.indexOf("selected");
  const to = from + "selected".length;
  const plan = planToggleComment(document, from, to);
  assert.equal(plan.kind, "apply");
  if (plan.kind === "apply") {
    assert.equal(applyEdit(document, plan.edit), "Before %% selected %% after");
    assert.equal(
      applyEdit(document, plan.edit).slice(
        plan.edit.selectionFrom,
        plan.edit.selectionTo,
      ),
      "selected",
    );
  }
});

test("Toggle comment wraps the whole word when the cursor is inside it", () => {
  const document = "nota";
  const plan = planToggleComment(document, 2);
  assert.equal(plan.kind, "apply");
  if (plan.kind === "apply") {
    const updated = applyEdit(document, plan.edit);
    assert.equal(updated, "%% nota %%");
    assert.equal(updated.slice(0, plan.edit.selectionFrom), "%% nota");
    assert.equal(plan.edit.selectionFrom, plan.edit.selectionTo);
  }
});

test("Toggle comment does not capture a word at either boundary", () => {
  const document = "nota";
  const before = planToggleComment(document, 0);
  const after = planToggleComment(document, document.length);
  assert.equal(before.kind, "apply");
  assert.equal(after.kind, "apply");
  if (before.kind === "apply" && after.kind === "apply") {
    assert.equal(applyEdit(document, before.edit), "%%  %% nota");
    assert.equal(applyEdit(document, after.edit), "nota %%  %%");
  }
});

test("Toggle comment removes markers without nesting comments", () => {
  const document = "Before %% editorial note %% after";
  const cursor = document.indexOf("note") + 2;
  const plan = planToggleComment(document, cursor);
  assert.equal(plan.kind, "remove");
  if (plan.kind === "remove") {
    assert.equal(applyEdit(document, plan.edit), "Before editorial note after");
  }
});

test("Toggle comment includes the position immediately after the closing marker", () => {
  const document = "%% editorial note %%";
  const plan = planToggleComment(document, document.length);
  assert.equal(plan.kind, "remove");
  if (plan.kind === "remove") {
    assert.equal(applyEdit(document, plan.edit), "editorial note");
  }
});

test("Toggle comment removes an empty generated comment", () => {
  const document = "Before %%  %% after";
  const cursor = document.indexOf("  ") + 1;
  const plan = planToggleComment(document, cursor);
  assert.equal(plan.kind, "remove");
  if (plan.kind === "remove") {
    assert.equal(applyEdit(document, plan.edit), "Before after");
  }
});

test("Toggle comment blocks selections crossing a comment boundary", () => {
  const document = "Before %% note %% after";
  assert.deepEqual(planToggleComment(document, 0, document.length), {
    kind: "blocked",
  });
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
