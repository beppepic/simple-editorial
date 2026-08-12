import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";
import {
  buildCommentEdit,
  findCommentBodyAt,
} from "./editorial-core";
import {
  CommentModeExtension,
  createCommentModeExtension,
} from "./comment-mode";
import { protectEditorSelection } from "./ui-events";

export default class SimpleEditorialPlugin extends Plugin {
  private commentModeEnabled = false;
  private commentMode!: CommentModeExtension;
  private modeActions = new Map<MarkdownView, HTMLElement>();

  onload(): void {
    this.commentMode = createCommentModeExtension({
      isEnabled: () => this.commentModeEnabled,
    });
    this.registerEditorExtension(this.commentMode.extension);

    this.addCommand({
      id: "insert-comment",
      name: "Insert comment",
      icon: "message-square-plus",
      editorCallback: (editor) => this.insertComment(editor),
    });

    this.addCommand({
      id: "toggle-comment-mode",
      name: "Toggle Comment Mode",
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

  private insertComment(editor: Editor): void {
    if (editor.somethingSelected()) {
      new Notice("Insert comment requires an empty selection.");
      return;
    }

    const cursor = editor.getCursor();
    const position = editor.posToOffset(cursor);
    const edit = buildCommentEdit(editor.getValue(), position, "");
    editor.replaceRange(edit.insert, cursor);
    editor.setCursor(editor.offsetToPos(edit.selectionFrom));
  }

  private toggleCommentMode(view: MarkdownView): void {
    const editorView = this.getEditorView(view);

    if (this.commentModeEnabled) {
      this.moveCursorOutsideComment(view.editor);
    }

    this.commentModeEnabled = !this.commentModeEnabled;
    this.syncModeToAllViews();
    if (editorView) this.commentMode.setEnabled(editorView, this.commentModeEnabled);

    new Notice(
      `Simple Editorial: Comment Mode ${this.commentModeEnabled ? "ON" : "OFF"}`,
    );
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
    const editorView = this.getEditorView(view);
    if (editorView) this.commentMode.setEnabled(editorView, this.commentModeEnabled);
    const action = this.ensureModeAction(view);
    const state = this.commentModeEnabled ? "ON" : "OFF";
    action.setAttribute("aria-label", `Simple Editorial: Comment Mode ${state}`);
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
      "Simple Editorial: Comment Mode OFF",
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

  private getEditorView(view: MarkdownView): EditorView | null {
    const editor = view.editor as Editor & { cm?: EditorView };
    return editor.cm ?? null;
  }
}
