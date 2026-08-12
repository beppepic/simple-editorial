export interface PreventableEditorEvent {
  preventDefault(): void;
  stopPropagation(): void;
}

export function protectEditorSelection(event: PreventableEditorEvent): void {
  event.preventDefault();
  event.stopPropagation();
}
