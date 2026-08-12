import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { EditorView } from "@codemirror/view";
import {
  buildCommentEdit,
  findCommentBodyAt,
  planStrikeToggle,
} from "./editorial-core";
import {
  CommentModeExtension,
  createCommentModeExtension,
} from "./comment-mode";

export default class SimpleEditorialPlugin extends Plugin {
  private commentModeEnabled = false;
  private commentMode!: CommentModeExtension;

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

    this.addCommand({
      id: "toggle-strike",
      name: "Toggle strike",
      icon: "strikethrough",
      editorCallback: (editor) => this.toggleStrike(editor),
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) this.syncModeToView(view);
      }),
    );
  }

  onunload(): void {
    this.commentModeEnabled = false;
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

  private toggleStrike(editor: Editor): void {
    if (!editor.somethingSelected()) {
      new Notice("Select text before toggling strikethrough.");
      return;
    }

    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const edit = planStrikeToggle(
      editor.getValue(),
      editor.posToOffset(from),
      editor.posToOffset(to),
    );
    if (!edit) return;

    editor.replaceRange(
      edit.insert,
      editor.offsetToPos(edit.from),
      editor.offsetToPos(edit.to),
    );
    editor.setSelection(
      editor.offsetToPos(edit.selectionFrom),
      editor.offsetToPos(edit.selectionTo),
    );
  }

  private moveCursorOutsideComment(editor: Editor): void {
    if (editor.somethingSelected()) return;

    const position = editor.posToOffset(editor.getCursor());
    const range = findCommentBodyAt(editor.getValue(), position);
    if (range) editor.setCursor(editor.offsetToPos(range.markerTo));
  }

  private syncModeToAllViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView) this.syncModeToView(leaf.view);
    }
  }

  private syncModeToView(view: MarkdownView): void {
    const editorView = this.getEditorView(view);
    if (editorView) this.commentMode.setEnabled(editorView, this.commentModeEnabled);
  }

  private getEditorView(view: MarkdownView): EditorView | null {
    const editor = view.editor as Editor & { cm?: EditorView };
    return editor.cm ?? null;
  }
}
