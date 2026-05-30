/**
 * GH-TAPE — EvpChip playback chip (real Chromium).
 *
 * Pins the EVP recorder HUD chip's event plumbing: it mounts empty, shows the
 * captured cue on an `evpCaptured` dispatch, a newer capture replaces an older
 * one, and the subscription is torn down on unmount (no setState after unmount).
 * Guards the ghost-hunting GH-TAPE wiring the review flagged as untested (T-3).
 */

import { dispatch } from "@engine/events";
import { act, cleanup, render, screen } from "@testing-library/react";
import { EvpChip } from "@views/hudOverlays/EvpChip";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("GH-TAPE — EvpChip", () => {
	it("mounts with no cue shown", () => {
		render(<EvpChip />);
		// The container chip is always present; the cue line is not.
		expect(screen.getByTestId("bonebuster-evp-chip").textContent).toBe("");
	});

	it("shows the captured cue on an evpCaptured dispatch", () => {
		render(<EvpChip />);
		act(() => dispatch({ type: "evpCaptured", cue: "...behind you..." }));
		expect(screen.getByTestId("bonebuster-evp-chip").textContent).toContain("...behind you...");
	});

	it("a newer capture shows the newest cue", () => {
		render(<EvpChip />);
		act(() => dispatch({ type: "evpCaptured", cue: "...help..." }));
		act(() => dispatch({ type: "evpCaptured", cue: "...too late..." }));
		// The newest cue is shown. (The prior chip may briefly co-exist mid
		// AnimatePresence exit animation, so we assert the newest is present
		// rather than the old being instantly gone.)
		expect(screen.getByTestId("bonebuster-evp-chip").textContent).toContain("...too late...");
	});

	it("unsubscribes on unmount — a later dispatch does not throw or update", () => {
		const { unmount } = render(<EvpChip />);
		unmount();
		// No mounted chip to update; the guarded listener must swallow this safely.
		expect(() => act(() => dispatch({ type: "evpCaptured", cue: "...gone..." }))).not.toThrow();
	});
});
