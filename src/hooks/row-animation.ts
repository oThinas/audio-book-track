/**
 * Shared row-animation tokens for list enter/exit transitions (feature 037).
 *
 * Centralizing the classes and duration keeps the four list surfaces
 * (chapters, narrators, editors, studios) consistent (FR-009) and routes every
 * visual value through a single source instead of hardcoding it per row.
 *
 * Classes come from `tw-animate-css` (already imported in globals.css). Only
 * compositor-friendly properties are animated (opacity via `fade-*`, transform
 * via `slide-*`); width/height are never animated. `motion-reduce:animate-none`
 * disables the animation under `prefers-reduced-motion: reduce`.
 */

/** Applied to a row entering the list (created/confirmed). */
export const ROW_ENTER_CLASS =
  "animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none";

/** Applied to a row leaving the list (removed) while it is retained for the exit animation. */
export const ROW_EXIT_CLASS =
  "animate-out fade-out-0 slide-out-to-top-2 duration-200 motion-reduce:animate-none";

/** Duration of the enter/exit animation in milliseconds (matches `duration-200`). */
export const ROW_ANIMATION_DURATION_MS = 200;

/** Presence state of a single row. */
export type RowState = "entering" | "exiting" | "idle";
