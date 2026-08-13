import { Annotation, Extension, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { planCommentModeInput } from "./editorial-core";

export interface CommentModeController {
  isEnabled(): boolean;
}

export function createCommentModeExtension(
  controller: CommentModeController,
): Extension {
  const inputHandler = EditorView.inputHandler.of(
    (view, from, to, text, insert): boolean => {
      if (!controller.isEnabled()) return false;

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

  const editorClass = controller.isEnabled()
    ? "simple-editorial-editor simple-editorial-comment-mode"
    : "simple-editorial-editor";

  return [
    inputHandler,
    EditorView.editorAttributes.of({ class: editorClass }),
  ];
}
