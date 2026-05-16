/**
 * Bone Buster type tokens.
 *
 * Four curated families, self-hosted via `@fontsource/*` packages
 * (no CDN — S2 CSP enforcement + Capacitor offline support):
 *
 *   - **Bungee** family (display) — `bungee`, `bungee-inline`,
 *     `bungee-shade`. The Bone Buster wordmark is layered Bungee
 *     + Bungee Inline + Bungee Shade for letterpress depth. Every
 *     numeric readout (HP / score / kill count / ammo) and every
 *     overlay heading (LEVEL COMPLETE, YOU DIED, MISSION COMPLETE)
 *     sits in plain Bungee.
 *   - **Space Grotesk** (body) — modern geometric sans. HUD
 *     sub-labels, in-game subtitles, settings copy, kill-confirm
 *     popups. Variable weight family (300-700).
 *   - **JetBrains Mono** (mono) — the debug overlay, the perf
 *     readout (`SCORE`/`KILLS`/`HP`), and the optional
 *     coordinate-readout dev tier.
 *   - **Tilt Prism** (flair) — animated phase-transition glyph
 *     for the landing lock-in moment and the level-name handoff.
 *     Use sparingly — it's expressive enough that overuse reads
 *     as decoration noise.
 *
 * The fonts are imported by `app/main.tsx` via:
 *   import "@fontsource/bungee/400.css";
 *   import "@fontsource/bungee-inline/400.css";
 *   import "@fontsource/bungee-shade/400.css";
 *   import "@fontsource/space-grotesk/{300,400,500,600,700}.css";
 *   import "@fontsource/jetbrains-mono/{400,500,700}.css";
 *   import "@fontsource/tilt-prism/400.css";
 *
 * Each `@fontsource` import is byte-for-byte the self-hosted woff2
 * file from the font's package; no CDN fetch happens at runtime.
 *
 * `FONT_FAMILY` (legacy keys: body/display/mono with the OBJEXOOM
 * Rajdhani/Black-Ops-One stacks) is kept exported until the R7 HUD
 * pass finishes the transition; the canonical post-rebrand surface
 * is `TYPE.{display,body,mono,flair}` below.
 */

/**
 * Bone Buster post-rebrand type tokens (PRD §R1). Use these for
 * every new surface. Each value is a CSS `font-family` stack with
 * graceful fallbacks for the brief window before the woff2 lands.
 */
export const TYPE = {
	display:
		'"Bungee", "Bungee Inline", "Bungee Shade", "Black Ops One", ui-sans-serif, system-ui, sans-serif',
	body: '"Space Grotesk", "Rajdhani", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	mono: '"JetBrains Mono", ui-monospace, "Menlo", "Monaco", "Consolas", monospace',
	flair: '"Tilt Prism", "Bungee", "Bungee Inline", ui-sans-serif, system-ui, sans-serif',
} as const;

/**
 * R7 — legacy FONT_FAMILY surface re-pointed at the bone palette.
 *
 * Originally FONT_FAMILY held the OBJEXOOM-era Rajdhani / Black Ops
 * One stacks. The R7 HUD refresh pivots HUD chips + readouts to the
 * Bungee / Space Grotesk / JetBrains Mono triad without touching
 * every call site — by re-pointing FONT_FAMILY at TYPE's stacks,
 * the existing `FONT_FAMILY.display` references in HUD.tsx,
 * hudOverlays/*, and Landing.tsx all switch fonts in one place.
 *
 * Net effect: numerals + level names now render in Bungee (display);
 * sub-labels render in Space Grotesk (body); debug overlay renders
 * in JetBrains Mono (mono). PRD §R7 acceptance met.
 *
 * New code should reference TYPE directly. FONT_FAMILY is retained
 * as a compatibility re-export; future cleanup commits can sweep
 * `FONT_FAMILY.<key>` → `TYPE.<key>` without changing the rendered
 * pixels (the stacks are now identical).
 */
export const FONT_FAMILY = {
	body: TYPE.body,
	display: TYPE.display,
	mono: TYPE.mono,
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
