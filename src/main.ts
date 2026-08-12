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

interface ModeToolbar {
  root: HTMLElement;
  button: HTMLButtonElement;
}

export default class SimpleEditorialPlugin extends Plugin {
  private commentModeEnabled = false;
  private commentMode!: CommentModeExtension;
  private modeToolbars = new Map<MarkdownView, ModeToolbar>();

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
    for (const [view] of this.modeToolbars) this.removeModeToolbar(view);
    this.modeToolbars.clear();
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

    for (const [view] of this.modeToolbars) {
      if (!liveViews.has(view)) this.removeModeToolbar(view);
    }
  }

  private syncModeToView(view: MarkdownView): void {
    const editorView = this.getEditorView(view);
    if (editorView) this.commentMode.setEnabled(editorView, this.commentModeEnabled);
    const toolbar = this.ensureModeToolbar(view);
    toolbar.button.textContent = `COMMENT MODE ${this.commentModeEnabled ? "ON" : "OFF"}`;
    toolbar.button.setAttribute("aria-pressed", String(this.commentModeEnabled));
    toolbar.root.classList.toggle("is-enabled", this.commentModeEnabled);
  }

  private ensureModeToolbar(view: MarkdownView): ModeToolbar {
    const existing = this.modeToolbars.get(view);
    if (existing?.root.isConnected) return existing;
    if (existing) this.modeToolbars.delete(view);

    const toolbar = view.containerEl.ownerDocument.createElement("div");
    toolbar.className = "simple-editorial-mode-toolbar";

    const button = view.containerEl.ownerDocument.createElement("button");
    button.className = "simple-editorial-mode-toggle";
    button.type = "button";
    button.setAttribute("aria-label", "Toggle Simple Editorial Comment Mode");
    button.addEventListener("pointerdown", protectEditorSelection);
    button.addEventListener("click", (event) => {
      protectEditorSelection(event);
      this.toggleCommentMode(view);
    });

    toolbar.appendChild(button);
    view.containerEl.classList.add("simple-editorial-toolbar-active");
    view.containerEl.insertBefore(toolbar, view.contentEl);

    const result = { root: toolbar, button };
    this.modeToolbars.set(view, result);
    return result;
  }

  private removeModeToolbar(view: MarkdownView): void {
    this.modeToolbars.get(view)?.root.remove();
    this.modeToolbars.delete(view);
    view.containerEl.classList.remove("simple-editorial-toolbar-active");
  }

  private getEditorView(view: MarkdownView): EditorView | null {
    const editor = view.editor as Editor & { cm?: EditorView };
    return editor.cm ?? null;
  }
}
