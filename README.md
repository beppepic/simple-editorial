# Simple Editorial

Simple Editorial is a minimal Obsidian plugin for lightweight manuscript editing on iPhone and macOS. It uses only ordinary Markdown and native Obsidian syntax.

## Features

- **Persistent Comment Mode toggle**: the same view-header action is available on iPhone and macOS. Its icon is neutral when Comment Mode is off and editorial red when it is on. With an empty cursor, the first text you type is automatically wrapped as an Obsidian comment: `%% comment %%`. Comment Mode stays on while you move between Markdown notes and resets when Obsidian or the plugin reloads.
- **Insert comment**: inserts `%%  %%` at an empty cursor and places the cursor between the markers.
- **Editorial styling**: comments and Obsidian's native strikethrough use `#C64A3D` in the editor.

Comment Mode does not lock the document. Selections, deletion, replacement, Return, paste, cut, drag-and-drop, undo, redo, and other normal Obsidian editing remain unchanged. Typing inside an existing comment also remains normal.

## Mobile Toolbar

The persistent toggle requires no setup. To add the optional **Insert comment** command to Obsidian's Mobile Toolbar, open:

**Settings → Mobile → Manage toolbar options → Add global command**

Search for **Simple Editorial: Insert comment** and add it to the toolbar.

## Beta installation with BRAT

1. Install and enable BRAT from Obsidian Community Plugins.
2. Open **Settings → BRAT**.
3. Choose **Add Beta plugin**.
4. Enter `beppepic/simple-editorial`.
5. Enable **Simple Editorial** under **Settings → Community plugins**.

This beta is intended for direct testing and is not submitted to the official Obsidian Community Plugins catalog.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
