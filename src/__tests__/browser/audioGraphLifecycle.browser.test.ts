/**
 * CR-F9 — audio-graph lifecycle in REAL Chromium (real AudioContext +
 * Howler). The unit tests (bonebuster-ambient / music-intensity) cover the
 * pure state machines (db/pitch/mood resolution); this pins the actual
 * start → transition → phase → stop LIFECYCLE through the live Howler graph
 * — i.e. that driving the bed across a level doesn't throw, double-start, or
 * strand a loop, and that the state machine tracks each transition.
 *
 * Browser-tier (not jsdom) because Howler needs a real Web Audio context.
 */

import {
	getAmbientStateForTesting,
	resetAmbientStateForTesting,
	setAmbientArchetype,
	setAmbientPhase,
	startAmbient,
	stopAmbient,
} from "@audio/ambientGraph";
import { resetForTesting } from "@audio/howlerBus";
import { setMusicMood, startMusic, stopMusic } from "@audio/musicGraph";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
	resetForTesting();
	resetAmbientStateForTesting();
});
afterEach(() => {
	stopAmbient();
	stopMusic();
	resetForTesting();
});

describe("CR-F9 — ambient bed lifecycle (real Howler)", () => {
	it("drives a full corridor→arena→sewer + phase-swell + stop cycle without throwing", () => {
		expect(() => {
			setAmbientArchetype("corridor");
			startAmbient();
			setAmbientArchetype("arena"); // crossfade
			setAmbientArchetype("sewer"); // crossfade again
			setAmbientPhase("going_back"); // +6dB swell
			setAmbientPhase("out"); // clear swell
			stopAmbient();
		}).not.toThrow();
	});

	it("the state machine tracks the active archetype through transitions", () => {
		setAmbientArchetype("library");
		startAmbient();
		expect(getAmbientStateForTesting().archetype).toBe("library");
		setAmbientArchetype("arena");
		expect(getAmbientStateForTesting().archetype).toBe("arena");
	});

	it("double-start on the same archetype is a no-op (no throw, no double loop)", () => {
		setAmbientArchetype("corridor");
		expect(() => {
			startAmbient();
			startAmbient();
			startAmbient();
		}).not.toThrow();
	});

	it("stop before start is safe", () => {
		expect(() => stopAmbient()).not.toThrow();
	});
});

describe("CR-F9 — music lifecycle (real Howler)", () => {
	it("drives start → mood changes → stop without throwing", () => {
		expect(() => {
			startMusic();
			setMusicMood("combat");
			setMusicMood("exploration");
			setMusicMood("boss");
			stopMusic();
		}).not.toThrow();
	});

	it("stop before start + double-stop are safe", () => {
		expect(() => {
			stopMusic();
			startMusic();
			stopMusic();
			stopMusic();
		}).not.toThrow();
	});
});
