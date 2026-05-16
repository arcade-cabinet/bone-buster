/**
 * E11 — per-archetype + phase-reactive ambient bed contract.
 *
 * Pins the resolved pitch/volume for each archetype and confirms the
 * +6dB phase boost. Doesn't touch the audio graph — only the state
 * accessors via getAmbientStateForTesting().
 */

import {
	type AmbientArchetype,
	getAmbientStateForTesting,
	resetAmbientStateForTesting,
	setAmbientArchetype,
	setAmbientPhase,
} from "@audio/sfx";
import { beforeEach, describe, expect, it } from "vitest";

describe("E11 — ambient archetype + phase state", () => {
	beforeEach(() => {
		resetAmbientStateForTesting();
	});

	it("defaults to corridor / out", () => {
		const s = getAmbientStateForTesting();
		expect(s.archetype).toBe("corridor");
		expect(s.phase).toBe("out");
	});

	it("setAmbientArchetype changes the resolved archetype + pitch", () => {
		setAmbientArchetype("sewer");
		const s = getAmbientStateForTesting();
		expect(s.archetype).toBe("sewer");
		// Sewer uses A0 — sub-bass per PRD §E11 "oppressive sewer".
		expect(s.resolvedPitch).toBe("A0");
	});

	it("phase = going_back swells volume by +6dB", () => {
		setAmbientArchetype("corridor");
		const dry = getAmbientStateForTesting();
		setAmbientPhase("going_back");
		const wet = getAmbientStateForTesting();
		expect(wet.resolvedVolumeDb).toBe(dry.resolvedVolumeDb + 6);
	});

	it("phase = out clears the swell", () => {
		setAmbientPhase("going_back");
		setAmbientPhase("out");
		const s = getAmbientStateForTesting();
		expect(s.phase).toBe("out");
		// Volume back to the archetype base.
		expect(s.resolvedVolumeDb).toBeLessThan(0); // -32 for corridor
	});

	it("each archetype has a distinct pitch", () => {
		const archetypes: AmbientArchetype[] = ["corridor", "arena", "courtyard", "sewer", "library"];
		const pitches = new Set<string>();
		for (const a of archetypes) {
			setAmbientArchetype(a);
			pitches.add(getAmbientStateForTesting().resolvedPitch);
		}
		expect(pitches.size).toBe(5);
	});

	it("each archetype's base volume is < 0 dB (quiet bed, not foreground)", () => {
		const archetypes: AmbientArchetype[] = ["corridor", "arena", "courtyard", "sewer", "library"];
		for (const a of archetypes) {
			setAmbientArchetype(a);
			setAmbientPhase("out");
			expect(getAmbientStateForTesting().resolvedVolumeDb).toBeLessThan(0);
		}
	});

	it("setAmbientArchetype is idempotent (same archetype → no state change)", () => {
		setAmbientArchetype("arena");
		const a = getAmbientStateForTesting();
		setAmbientArchetype("arena");
		const b = getAmbientStateForTesting();
		expect(a).toEqual(b);
	});
});
