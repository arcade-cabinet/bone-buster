/**
 * QW9 — extracted fade-trigger tables. Pre-QW9 these lived inline in
 * `triggerFade` inside ObjexoomShell.tsx, and a "drift canary" test
 * (`objexoom-fade.test.ts`) defined a local copy that asserted against
 * itself — a tautology that couldn't catch real drift. Moving the
 * tables here lets the test import the SAME table the runtime uses.
 *
 * Color values flow through design tokens (ROLE/SCALE), so the test
 * assertions read against the token-resolved string at import time.
 */

import { ROLE, SCALE } from "./design-tokens";
import type { FadeKind } from "./ObjexoomShell";

export const FADE_COLOR_BY_KIND: Readonly<Record<FadeKind, string>> = {
	damage: ROLE.actionDamage,
	key: SCALE.amber[400],
	flash: SCALE.parchment[50],
	win: SCALE.parchment[50],
};

export const FADE_PEAK_BY_KIND: Readonly<Record<FadeKind, number>> = {
	damage: 0.55,
	key: 0.4,
	flash: 0.5,
	win: 0.85,
};

/**
 * Compute the trigger payload for a fade. Intensity scales the peak;
 * cap at 1 so over-amplified damage doesn't exceed opaque.
 */
export function computeFadePeak(kind: FadeKind, intensity: number): number {
	return Math.min(1, FADE_PEAK_BY_KIND[kind] * intensity);
}
