/**
 * CR-H1scene step-d — shared game-lifecycle constants, extracted from
 * BoneBusterShell into a leaf module. The pure `gameReducer` and the
 * `useLevelTransition` hook both need these VALUES; importing them from
 * `@views/Shell` created a value-import cycle (Shell → reducer/hook → Shell).
 * A leaf module both sides import from breaks the cycle cleanly.
 */

export const TRANSITION_HOLD_MS = 800;
// (RUN_LENGTH lives in @store/runStats — advanceLevel/nextStatusAfterTransition
// own it; no duplicate here.)
/**
 * POL37 — total budget the player has to retrace from the goal back
 * to spawn after the boss + key are taken. 30s is long enough to
 * traverse any procedural map at a brisk walk; too short feels like
 * a punish, too long defeats the "urgent retreat" reading.
 */
export const GOING_BACK_BUDGET_MS = 30_000;
