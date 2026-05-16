/**
 * PB5 step-1 — EMF reader contract.
 *
 * The first ghost-hunting tool. A passive HUD chip that reads the
 * distance to the nearest live enemy and emits a stepwise 1-5
 * level matching Phasmophobia's EMF semantics (5 = within touching
 * distance, 1 = far / no signal). See `docs/GHOST-HUNTING.md` for
 * the full slice sequencing and why this is step-1.
 *
 * Pure function — no GameState mutation, no event dispatch. The
 * Scene's per-frame tick reads the nearest-enemy distance and feeds
 * it into `pickEmfReading`; the result is rendered by the EMF chip
 * HUD slot. Distance is in tiles.
 */

export type EmfReading = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Phasmophobia-style thresholds. Adapted from a 4-room Phasmo
 * playthrough: 5 is "you should already be running", 1 is the
 * baseline ambient blip that proves the tool is alive.
 *
 * Returns 0 only when there is no live enemy on the map at all
 * (the caller passes `Number.POSITIVE_INFINITY`); a finite distance
 * always yields ≥1 so the chip never reads as "broken" while
 * something exists to detect.
 */
const EMF_THRESHOLDS: readonly { max: number; level: EmfReading }[] = [
	{ max: 2, level: 5 },
	{ max: 4, level: 4 },
	{ max: 8, level: 3 },
	{ max: 16, level: 2 },
	{ max: Number.POSITIVE_INFINITY, level: 1 },
];

export function pickEmfReading(distanceTiles: number): EmfReading {
	if (!Number.isFinite(distanceTiles)) return 0;
	if (distanceTiles < 0) return 5; // overlap is the strongest reading possible
	for (const { max, level } of EMF_THRESHOLDS) {
		if (distanceTiles < max) return level;
	}
	return 1;
}

/**
 * Tailwind-friendly token name for each reading; consumed by the
 * HUD chip's color ramp. Kept here (not in the chip component) so
 * the visual ramp is testable without a render harness.
 */
export const EMF_TOKEN: Readonly<Record<EmfReading, string>> = {
	0: "bone.500", // hidden / no signal
	1: "bone.300",
	2: "warning.400",
	3: "warning.500",
	4: "blood.500",
	5: "blood.600",
};
