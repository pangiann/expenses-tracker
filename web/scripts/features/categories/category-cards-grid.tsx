import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';

import type { MonthRecord } from '../../../../shared/month/month-record.ts';
import * as categoriesApi from '../../api/categories-api.ts';
import { LiftedCategoryCard, SortableCategoryCard } from './category-card.tsx';
import { NewCategoryCard } from './new-category-card.tsx';

/**
 * The category cards, followed by the "New category" card. Cards can be reordered by
 * dragging their header, the way Chrome reorders tabs: the card lifts and follows the
 * pointer, the others slide aside, and it glides into its slot when dropped. @dnd-kit does
 * the moving and the animation; this component decides what can move and saves the result
 * (categoriesApi.moveCategory: the category now sits before the one after it, or last).
 *
 * - A press that doesn't move 5 px stays a click, so the name and budget can still be edited.
 * - On touch screens the card lifts after holding it for a moment, so swiping still scrolls.
 * - Near the top or bottom of the window the page scrolls by itself.
 * - The "New category" card can't move and always stays last.
 * - Text can't be selected while dragging (Safari would otherwise highlight every card the
 *   pointer passes over).
 */
export function CategoryCardsGrid({ month }: { month: MonthRecord }) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );
  /** While a card is dragged: its id, and the month as it was when the drag started. */
  const [drag, setDrag] = useState<{ categoryId: string; month: MonthRecord } | null>(null);
  // A month that arrives during a drag is drawn when the drag ends, so the cards don't jump.
  const shownMonth = drag?.month ?? month;
  const categoryIds = shownMonth.categories.map((category) => category.id);
  const draggedCategory = drag ? shownMonth.findCategory(drag.categoryId) : undefined;

  const endDrag = () => {
    setDrag(null);
    setTextSelectionBlocked(false);
  };

  return (
    <div className="category-cards">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }: DragStartEvent) => {
          setTextSelectionBlocked(true);
          setDrag({ categoryId: String(active.id), month });
        }}
        onDragEnd={({ active, over }: DragEndEvent) => {
          endDrag();
          if (!over || active.id === over.id) return;
          const newOrder = arrayMove(
            categoryIds,
            categoryIds.indexOf(String(active.id)),
            categoryIds.indexOf(String(over.id)),
          );
          const position = newOrder.indexOf(String(active.id));
          categoriesApi.moveCategory(month.monthKey, String(active.id), newOrder[position + 1] ?? null);
        }}
        onDragCancel={endDrag}
      >
        <SortableContext items={categoryIds} strategy={rectSortingStrategy}>
          {shownMonth.categories.map((category) => (
            <SortableCategoryCard key={category.id} category={category} month={shownMonth} />
          ))}
        </SortableContext>
        <DragOverlay>
          {draggedCategory && <LiftedCategoryCard category={draggedCategory} month={shownMonth} />}
        </DragOverlay>
      </DndContext>
      <NewCategoryCard month={month} />
    </div>
  );
}

/** Stops text selection on the whole page while a card is held, and clears what was selected. */
function setTextSelectionBlocked(isBlocked: boolean): void {
  document.documentElement.classList.toggle('is-dragging-category', isBlocked);
  window.getSelection()?.removeAllRanges();
}
