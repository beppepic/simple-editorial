import { Extension } from "@codemirror/state";
import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import {
  findCommentBodyAt,
  planToggleComment,
} from "./editorial-core";
import { createCommentModeExtension } from "./comment-mode";
import { protectEditorSelection } from "./ui-events";

export default class SimpleEditorialPlugin extends Plugin {
  private commentModeEnabled = false;
  private editorExtensions: Extension[] = [];
  private modeActions = new Map<MarkdownView, HTMLElement>();

  onload(): void {
    this.refreshEditorExtensions();
    this.registerEditorExtension(this.editorExtensions);

    this.addCommand({
      id: "insert-comment",
      name: "Toggle comment",
      icon: "message-square-plus",
      editorCallback: (editor, view) => {
        if (view instanceof MarkdownView) this.toggleComment(editor, view);
      },
    });

    this.addCommand({
      id: "toggle-comment-mode",
      name: "Toggle comment mode",
      icon: "message-square-more",
      editorCallback: (_editor, view) => {
        if (view instanceof MarkdownView) this.toggleCommentMode(view);
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.syncModeToAllViews();
      }),
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.syncModeToAllViews()),
    );
    this.app.workspace.onLayoutReady(() => this.syncModeToAllViews());
  }

  onunload(): void {
    this.commentModeEnabled = false;
    for (const [view] of this.modeActions) this.removeModeAction(view);
    this.modeActions.clear();
  }

  private toggleComment(editor: Editor, view: MarkdownView): void {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const plan = planToggleComment(
      editor.getValue(),
      editor.posToOffset(from),
      editor.posToOffset(to),
    );

    if (plan.kind === "blocked") {
      new Notice("Toggle comment cannot cross an existing comment.");
      return;
    }

    editor.replaceRange(
      plan.edit.insert,
      editor.offsetToPos(plan.edit.from),
      editor.offsetToPos(plan.edit.to),
    );
    view.contentEl.win.requestAnimationFrame(() => {
      if (!view.contentEl.isConnected) return;
      editor.setSelection(
        editor.offsetToPos(plan.edit.selectionFrom),
        editor.offsetToPos(plan.edit.selectionTo),
      );
    });
  }

  private toggleCommentMode(view: MarkdownView): void {
    if (this.commentModeEnabled) {
      this.moveCursorOutsideComment(view.editor);
    }

    this.commentModeEnabled = !this.commentModeEnabled;
    this.refreshEditorExtensions();
    this.app.workspace.updateOptions();
    this.syncModeToAllViews();
  }

  private moveCursorOutsideComment(editor: Editor): void {
    if (editor.somethingSelected()) return;

    const position = editor.posToOffset(editor.getCursor());
    const range = findCommentBodyAt(editor.getValue(), position);
    if (range) editor.setCursor(editor.offsetToPos(range.markerTo));
  }

  private syncModeToAllViews(): void {
    const liveViews = new Set<MarkdownView>();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (!(leaf.view instanceof MarkdownView)) continue;
      liveViews.add(leaf.view);
      this.syncModeToView(leaf.view);
    }

    for (const [view] of this.modeActions) {
      if (!liveViews.has(view)) this.removeModeAction(view);
    }
  }

  private syncModeToView(view: MarkdownView): void {
    const action = this.ensureModeAction(view);
    const state = this.commentModeEnabled ? "on" : "off";
    action.setAttribute("aria-label", `Simple Editorial: Comment mode ${state}`);
    action.setAttribute("aria-pressed", String(this.commentModeEnabled));
    action.setAttribute("data-tooltip-position", "bottom");
    action.classList.toggle("is-enabled", this.commentModeEnabled);
  }

  private ensureModeAction(view: MarkdownView): HTMLElement {
    const existing = this.modeActions.get(view);
    if (existing?.isConnected) return existing;
    if (existing) this.modeActions.delete(view);

    const action = view.addAction(
      "message-square-more",
      "Simple Editorial: Comment mode off",
      (event) => {
        protectEditorSelection(event);
        this.toggleCommentMode(view);
      },
    );
    action.classList.add("simple-editorial-mode-action");
    action.addEventListener("pointerdown", protectEditorSelection);
    this.modeActions.set(view, action);
    return action;
  }

  private removeModeAction(view: MarkdownView): void {
    this.modeActions.get(view)?.remove();
    this.modeActions.delete(view);
  }

  private refreshEditorExtensions(): void {
    this.editorExtensions.length = 0;
    this.editorExtensions.push(
      createCommentModeExtension({
        isEnabled: () => this.commentModeEnabled,
      }),
    );
  }
}
