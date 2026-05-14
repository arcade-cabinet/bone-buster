/**
 * OBJEXOOM type tokens.
 *
 * Two curated families, bundled locally (see `public/assets/fonts/`):
 *
 *   - Black Ops One — display font. Stencil-cut military horror; the
 *     OBJEXOOM wordmark + every overlay heading (LEVEL COMPLETE, YOU
 *     DIED, MISSION COMPLETE) sits in this. One weight only (400) —
 *     the typeface itself ships as a single weight.
 *   - Rajdhani — body + HUD copy. Condensed tactical sans with five
 *     weights (300, 400, 500, 600, 700). Plays naturally with Black
 *     Ops One; numerics tabular-aligned cleanly for the HP / ammo /
 *     kill readouts.
 *
 * Bundled locally rather than CDN-loaded because (a) the game runs in
 * Capacitor offline, and (b) we already hit a Playwright stability-
 * wait stall on font fetches during the e2e screenshot pass — fonts.css
 * blocks any external load attempts.
 *
 * Monospace tier is system-default — only the ammo readout uses it,
 * and Rajdhani's tabular numerals usually cover the slot anyway.
 */

export const FONT_FAMILY = {
	body: '"Rajdhani", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	display:
		'"Black Ops One", "Rajdhani", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
	mono: 'ui-monospace, "Menlo", "Monaco", "Consolas", monospace',
} as const;

export const FONT_WEIGHT = {
	regular: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
	black: 900,
} as const;

/**
 * Letter spacing tiers — display copy is widely tracked (DOOM splash),
 * body copy is neutral, hud chips/labels are extra-tight.
 */
export const LETTER_SPACING = {
	display: "0.04em",
	heading: "0.02em",
	body: "0",
	hudLabel: "0.18em",
	hudChip: "0.12em",
} as const;

/**
 * Type scale — base 16, 1.250 ratio (major third) with custom display
 * sizes for the DOOM-style hero overlays.
 */
export const FONT_SIZE = {
	hudLabel: "11px",
	hudChip: "12px",
	body: "14px",
	bodyLarge: "16px",
	subheading: "18px",
	heading: "22px",
	display: "32px",
	displayLarge: "44px",
	hero: "64px",
	wordmark: "96px",
} as const;

export const LINE_HEIGHT = {
	tight: 1.1,
	snug: 1.25,
	body: 1.5,
	relaxed: 1.65,
} as const;
