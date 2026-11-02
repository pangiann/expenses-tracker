/**
 * Reorders category cards by dragging their handle (⋮⋮), with a mouse, a finger or a pen,
 * or with the arrow keys when the handle has keyboard focus.
 *
 * While dragging, the card moves through the grid so you see where it will land. When you let
 * go, onMove(categoryId, beforeCategoryId) reports the result: the id of the category it now sits
 * before, or null when it is last. Nothing is reported when the card ends up where it started.
 *
 * Uses Pointer Events, which cover mouse and touch alike; the handle has `touch-action: none`
 * so a drag on a phone moves the card instead of scrolling the page.
 */
const CARD_SELECTOR = '.category-card[data-category-id]';
const HANDLE_SELECTOR = '.category-drag-handle';
const NEW_CATEGORY_CARD_SELECTOR = '.new-category-card';

export class CategoryDragController {
  /**
   * @param {HTMLElement} container  the grid holding the category cards
   * @param {object} callbacks
   * @param {(categoryId: string, beforeCategoryId: string | null) => void} callbacks.onMove
   * @param {() => void} callbacks.onDragEnd  called when a drag ends without moving anything
   */
  constructor(container, { onMove, onDragEnd }) {
    this.container = container;
    this.onMove = onMove;
    this.onDragEnd = onDragEnd;
    /** @type {{ card: HTMLElement, categoryId: string, startBeforeId: string | null } | null} */
    this.drag = null;

    container.addEventListener('pointerdown', (pointerEvent) => this.#startDrag(pointerEvent));
    container.addEventListener('pointermove', (pointerEvent) => this.#followPointer(pointerEvent));
    container.addEventListener('pointerup', () => this.#finishDrag());
    container.addEventListener('pointercancel', () => this.#finishDrag());
    container.addEventListener('keydown', (keyEvent) => this.#moveWithKeyboard(keyEvent));
  }

  get isDragging() {
    return this.drag !== null;
  }

  // ----- Pointer -----

  #startDrag(pointerEvent) {
    const handle = pointerEvent.target.closest(HANDLE_SELECTOR);
    if (!handle || pointerEvent.button > 0) return;
    pointerEvent.preventDefault();
    const card = handle.closest(CARD_SELECTOR);
    this.drag = { card, categoryId: card.dataset.categoryId, startBeforeId: CategoryDragController.#beforeIdOf(card) };
    try {
      handle.setPointerCapture(pointerEvent.pointerId); // keep receiving moves outside the handle
    } catch {
      /* the pointer is already gone; moves still reach the grid */
    }
    card.classList.add('is-dragging');
    this.container.classList.add('is-reordering');
  }

  #followPointer(pointerEvent) {
    if (!this.drag) return;
    const elementUnderPointer = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
    if (!elementUnderPointer || this.drag.card.contains(elementUnderPointer)) return;

    // The "New category" card always stays last.
    const newCategoryCard = elementUnderPointer.closest(NEW_CATEGORY_CARD_SELECTOR);
    if (newCategoryCard) {
      this.container.insertBefore(this.drag.card, newCategoryCard);
      return;
    }
    const targetCard = elementUnderPointer.closest(CARD_SELECTOR);
    if (!targetCard || !this.container.contains(targetCard)) return;

    // Left half of a card: go before it; right half: go after it.
    const targetBounds = targetCard.getBoundingClientRect();
    const isPastMiddle = pointerEvent.clientX > targetBounds.left + targetBounds.width / 2;
    this.container.insertBefore(this.drag.card, isPastMiddle ? targetCard.nextElementSibling : targetCard);
  }

  #finishDrag() {
    if (!this.drag) return;
    const { card, categoryId, startBeforeId } = this.drag;
    this.drag = null;
    card.classList.remove('is-dragging');
    this.container.classList.remove('is-reordering');

    const beforeCategoryId = CategoryDragController.#beforeIdOf(card);
    if (beforeCategoryId === startBeforeId) this.onDragEnd();
    else this.onMove(categoryId, beforeCategoryId);
  }

  // ----- Keyboard -----

  /** Arrow keys on a focused handle move the card one place back or forward. */
  #moveWithKeyboard(keyEvent) {
    const handle = keyEvent.target.closest(HANDLE_SELECTOR);
    if (!handle) return;
    const card = handle.closest(CARD_SELECTOR);
    const cards = [...this.container.querySelectorAll(CARD_SELECTOR)];
    const position = cards.indexOf(card);

    let beforeCard;
    if (keyEvent.key === 'ArrowLeft' || keyEvent.key === 'ArrowUp') {
      if (position === 0) return;
      beforeCard = cards[position - 1];
    } else if (keyEvent.key === 'ArrowRight' || keyEvent.key === 'ArrowDown') {
      if (position === cards.length - 1) return;
      beforeCard = cards[position + 2] ?? null;
    } else {
      return;
    }
    keyEvent.preventDefault();
    this.onMove(card.dataset.categoryId, beforeCard ? beforeCard.dataset.categoryId : null);
  }

  /** The id of the category card right after this one, or null when it is the last. */
  static #beforeIdOf(card) {
    let nextElement = card.nextElementSibling;
    while (nextElement && !nextElement.matches(CARD_SELECTOR)) nextElement = nextElement.nextElementSibling;
    return nextElement ? nextElement.dataset.categoryId : null;
  }
}
