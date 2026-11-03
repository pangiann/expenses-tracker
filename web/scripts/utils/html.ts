const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Makes user-typed text safe to insert into HTML. */
export function escapeHtml(text: string | number): string {
  return String(text).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Shorthand for document.getElementById that fails loudly on a typo, and checks the kind of
 * element: getElement('quickAddAmount', HTMLInputElement).
 */
export function getElement<Kind extends HTMLElement = HTMLElement>(
  elementId: string,
  kind: abstract new () => Kind = HTMLElement as unknown as abstract new () => Kind,
): Kind {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`No element with id "${elementId}"`);
  if (!(element instanceof kind)) throw new Error(`#${elementId} is not a ${kind.name}`);
  return element;
}
