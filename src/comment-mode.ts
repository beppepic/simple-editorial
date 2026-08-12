import { Annotation, Extension, StateEffect, StateField, Transaction } from "@codemirror/state";
import { EditorView, Panel, showPanel } from "@codemirror/view";
import { planCommentModeInput } from "./editorial-core";

export interface CommentModeController {
  isEnabled(): boolean;
}

export interface CommentModeExtension {
  extension: Extension;
  setEnabled(view: EditorView, enabled: boolean): void;
}

function modePanel(): Panel {
  const dom = document.createElement("div");
  dom.className = "simple-editorial-mode-panel";
  dom.textContent = "Comment mode";
  dom.setAttribute("role", "status");
  dom.setAttribute("aria-label", "Simple Editorial Comment Mode is on");
  return { dom, top: true };
}

export function createCommentModeExtension(
  controller: CommentModeController,
): CommentModeExtension {
  const setMode = StateEffect.define<boolean>();
  const mode = StateField.define<boolean>({
    create: () => controller.isEnabled(),
    update(value, transaction) {
      for (const effect of transaction.effects) {
        if (effect.is(setMode)) return effect.value;
      }
      return value;
    },
  });

  const inputHandler = EditorView.inputHandler.of(
    (view, from, to, text, insert): boolean => {
      if (!view.state.field(mode)) return false;

      const defaultTransaction = insert();
      if (!defaultTransaction.isUserEvent("input.type")) return false;

      const plan = planCommentModeInput(view.state.doc.toString(), from, to, text);
      if (plan.kind === "pass") return false;

      const userEvent =
        defaultTransaction.annotation(Transaction.userEvent) ?? "input.type";
      const addToHistory = defaultTransaction.annotation(Transaction.addToHistory);
      const annotations: Annotation<unknown>[] = [
        Transaction.userEvent.of(userEvent),
      ];
      if (addToHistory !== undefined) {
        annotations.push(Transaction.addToHistory.of(addToHistory));
      }

      view.dispatch({
        changes: {
          from: plan.edit.from,
          to: plan.edit.to,
          insert: plan.edit.insert,
        },
        selection: {
          anchor: plan.edit.selectionFrom,
          head: plan.edit.selectionTo,
        },
        annotations,
        scrollIntoView: true,
      });
      return true;
    },
  );

  const extension: Extension = [
    mode,
    inputHandler,
    showPanel.from(mode, (enabled) => (enabled ? modePanel : null)),
    EditorView.editorAttributes.compute([mode], (state) =>
      ({
        class: state.field(mode) ? "simple-editorial-comment-mode" : "",
      }),
    ),
  ];

  return {
    extension,
    setEnabled(view, enabled) {
      view.dispatch({ effects: setMode.of(enabled) });
    },
  };
}
