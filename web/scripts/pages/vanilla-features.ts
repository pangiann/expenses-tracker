import type { MonthRecord } from '../../../shared/month/month-record.ts';
import { CategoryCards } from '../features/categories/category-cards.ts';
import { RecurringCostsPanel } from '../features/recurring-costs/recurring-costs-panel.ts';
import { monthPageStore, type MonthPageState } from './month-page-store.ts';

/** A part of the page that shows the month. */
interface MonthFeature {
  render(month: MonthRecord): void;
}

/**
 * The features that are not React components yet. They find their elements by id in the
 * markup month-page.tsx renders, and draw the state of month-page-store.ts into them.
 * Each one moves into month-page.tsx as a component; this file goes away with the last one.
 */
export class VanillaFeatures {
  readonly #features: MonthFeature[] = [new CategoryCards(), new RecurringCostsPanel()];
  #drawnState: MonthPageState | null = null;

  /** Draws on every change of the store. */
  start(): void {
    monthPageStore.subscribe(() => this.#render(monthPageStore.getState()));
    this.#render(monthPageStore.getState());
  }

  #render(state: MonthPageState): void {
    const previous = this.#drawnState;
    this.#drawnState = state;
    if (state.month && state.month !== previous?.month) {
      for (const feature of this.#features) feature.render(state.month);
    }
  }
}
