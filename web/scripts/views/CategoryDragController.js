import Sortable from '../../vendor/sortablejs/sortable.esm.js';

/**
 * Reorders category cards by dragging them by their header, the way Chrome reorders tabs:
 * the card lifts and follows the pointer, the other cards slide aside to make room, and the
 * card glides into its slot when dropped. SortableJS (web/vendor/sortablejs) does the moving
 * and the animation; this class only decides what can move and reports the result.
 *
 * - A click that doesn't move (5 px) stays a click, so the name and budget can still be edited.
 * - On touch screens the card lifts after holding it for a moment, so swiping still scrolls.
 * - Near the top or bottom of the window the page scrolls by itself.
 * - The "New category" card can't move and always stays last.
 * - Text can't be selected while dragging (WebKit, used by the Mac app, would otherwise
 *   highlight every card the pointer passes over).
 *
 * When a drag changes the order, onMove(categoryId, beforeCategoryId) reports it: the id of the
 * category the card now sits before, or null when it is last.
 */
const CARD_SELECTOR = '.category-card[data-category-id]';

export class CategoryDragController {
  /**
   * @param {HTMLElement} container  the grid holding the category cards
   * @param {object} callbacks
   * @param {(categoryId: string, beforeCategoryId: string | null) => void} callbacks.onMove
   * @param {() => void} callbacks.onDragEnd  called when a drag ends without moving anything
   */
  constructor(container, { onMove, onDragEnd }) {
    this.isDragging = false;

    Sortable.create(container, {
      draggable: CARD_SELECTOR,
      handle: '.category-card-header',
      filter: 'input, button', // typing in a field or pressing ✕ never starts a drag
      preventOnFilter: false,

      forceFallback: true, // same pointer-driven drag with mouse, touch and pen, in every browser
      fallbackTolerance: 5,
      delay: 220,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,

      animation: 180,
      easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
      ghostClass: 'is-drop-placeholder', // the gap where the card will land
      chosenClass: 'is-chosen',
      fallbackClass: 'is-lifted', // the copy that follows the pointer

      scroll: true,
      scrollSensitivity: 90,
      scrollSpeed: 16,
      bubbleScroll: true,

      onChoose: () => CategoryDragController.#setTextSelectionBlocked(true),
      onUnchoose: () => CategoryDragController.#setTextSelectionBlocked(false),
      onStart: () => {
        this.isDragging = true;
      },
      // The "New category" card stays last: nothing may be placed after it.
      onMove: (moveEvent) => !(moveEvent.related.classList.contains('new-category-card') && moveEvent.willInsertAfter),
      onEnd: (endEvent) => {
        this.isDragging = false;
        if (endEvent.oldIndex === endEvent.newIndex) {
          onDragEnd();
          return;
        }
        onMove(endEvent.item.dataset.categoryId, CategoryDragController.#beforeIdOf(endEvent.item));
      },
    });
  }

  /** Stops text selection on the whole page while a card is held, and clears what was selected. */
  static #setTextSelectionBlocked(isBlocked) {
    document.documentElement.classList.toggle('is-dragging-category', isBlocked);
    window.getSelection()?.removeAllRanges();
  }

  /** The id of the category card right after this one, or null when it is the last. */
  static #beforeIdOf(card) {
    let nextElement = card.nextElementSibling;
    while (nextElement && !nextElement.matches(CARD_SELECTOR)) nextElement = nextElement.nextElementSibling;
    return nextElement ? nextElement.dataset.categoryId : null;
  }
}
