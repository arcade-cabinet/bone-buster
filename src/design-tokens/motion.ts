/**
 * OBJEXOOM motion tokens.
 *
 * Three pacing tiers:
 *  - twitch: HUD pop-ins, hit reactions, weapon-swap
 *  - flow:   menu transitions, fade overlays, level transitions
 *  - dread:  ambient sway, dread builders, going-back ramp
 *
 * Easing functions match Objexiv's where possible (the "cinematic"
 * cubic-bezier set is a homage). OBJEXOOM adds `dread` for the slow
 * inevitable creep of the going-back phase.
 */

export const DURATION = {
	instant: 80,
	twitch: 160,
	swap: 220,
	flow: 380,
	bookend: 600,
	transition: 900,
	dread: 1800,
	loop: 2400,
} as const;

export const EASING = {
	// Cubic-bezier presets — string form so they pass straight to CSS
	// transition + framer-motion `ease`.
	linear: "linear",
	standard: "cubic-bezier(0.4, 0, 0.2, 1)", // Material ease — twitch
	emphasis: "cubic-bezier(0.16, 1, 0.3, 1)", // Apple-spring — swap
	deepIn: "cubic-bezier(0.7, 0, 0.84, 0)", // anticipation — dread
	deepOut: "cubic-bezier(0.34, 1.56, 0.64, 1)", // overshoot — pop
	cinematic: "cubic-bezier(0.86, 0, 0.07, 1)", // Objexiv homage — flow
} as const;

export const STROBE = {
	// Reference DOOM clone strobes the spotlight over a 200-frame cycle.
	// We expose the period in ms so the renderer can sync to it.
	cyclePeriodMs: 3333,
	minIntensity: 0.18,
	maxIntensity: 1.0,
} as const;
