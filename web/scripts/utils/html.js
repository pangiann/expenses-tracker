const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Makes user-typed text safe to insert into HTML. */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** Shorthand for document.getElementById that fails loudly on a typo. */
export function getElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`No element with id "${elementId}"`);
  return element;
}
