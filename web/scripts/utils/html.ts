const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Makes user-typed text safe to insert into HTML. */
export function escapeHtml(text: string | number): string {
  return String(text).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Shorthand for document.getElementById that fails loudly on a typo. Name the kind of element
 * to have it checked too: getElement('quickAddAmount', HTMLInputElement).
 */
export function getElement(elementId: string): HTMLElement;
export function getElement<Kind extends Element>(elementId: string, kind: abstract new () => Kind): Kind;
export function getElement(elementId: string, kind?: abstract new () => Element): Element {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`No element with id "${elementId}"`);
  if (kind && !(element instanceof kind)) throw new Error(`#${elementId} is not a ${kind.name}`);
  return element;
}
