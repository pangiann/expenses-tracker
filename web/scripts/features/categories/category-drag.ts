import Sortable from 'sortablejs';

/**
 * Reorders category cards by dragging them by their header, the way Chrome reorders tabs:
 * the card lifts and follows the pointer, the other cards slide aside to make room, and the
 * card glides into its slot when dropped. SortableJS (npm package sortablejs) does the moving
 * and the animation; this class only decides what can move and reports the result.
 *
 * - A click that doesn't move (5 px) stays a click, so the name and budget can still be edited.
 * - On touch screens the card lifts after holding it for a moment, so swiping still scrolls.
 * - Near the top or bottom of the window the page scrolls by itself.
 * - The "New category" card can't move and always stays last.
 * - Text can't be selected while dragging (Safari would otherwise highlight every card the
 *   pointer passes over).
 *
 * When a drag changes the order, onMove(categoryId, beforeCategoryId) reports it: the id of the
 * category the card now sits before, or null when it is last.
 */
const CARD_SELECTOR = '.category-card[data-category-id]';

export class CategoryDrag {
  isDragging = false;

  /**
   * @param container  the grid holding the category cards
   * @param callbacks.onDragEnd  called when a drag ends without moving anything
   */
  constructor(
    container: HTMLElement,
    {
      onMove,
      onDragEnd,
    }: { onMove: (categoryId: string, beforeCategoryId: string | null) => void; onDragEnd: () => void },
  ) {
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

      onChoose: () => setTextSelectionBlocked(true),
      onUnchoose: () => setTextSelectionBlocked(false),
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
        const categoryId = endEvent.item.dataset.categoryId;
        if (categoryId) onMove(categoryId, beforeIdOf(endEvent.item));
      },
    });
  }
}

/** Stops text selection on the whole page while a card is held, and clears what was selected. */
function setTextSelectionBlocked(isBlocked: boolean): void {
  document.documentElement.classList.toggle('is-dragging-category', isBlocked);
  window.getSelection()?.removeAllRanges();
}

/** The id of the category card right after this one, or null when it is the last. */
function beforeIdOf(card: HTMLElement): string | null {
  let nextElement = card.nextElementSibling;
  while (nextElement && !nextElement.matches(CARD_SELECTOR)) nextElement = nextElement.nextElementSibling;
  return nextElement instanceof HTMLElement ? (nextElement.dataset.categoryId ?? null) : null;
}
