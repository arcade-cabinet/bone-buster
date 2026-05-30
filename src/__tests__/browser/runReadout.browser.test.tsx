/**
 * RunReadout — HUD secondary-readout chips (real Chromium).
 *
 * Pins the SCORE / SECRETS / PRESTIGE pop-in chips: each appears only when its
 * value is non-zero, and PRESTIGE derives from levels-cleared via prestigeTier
 * (STRUCT1 D23 — the endless run's progression marker). Guards the wiring so
 * prestigeTier can never silently become dead again (review QUAL-H1 / T-2).
 */

import { PRESTIGE_INTERVAL } from "@store/runStats";
import { cleanup, render, screen } from "@testing-library/react";
import { RunReadout } from "@views/hudOverlays/RunReadout";
import { afterEach, describe, expect, it } from "vitest";

afterEach(() => cleanup());

describe("RunReadout — HUD readout chips", () => {
	it("renders nothing when score, secrets, and prestige are all zero", () => {
		const { container } = render(<RunReadout score={0} secrets={0} levelsCleared={0} />);
		expect(container.querySelector("[data-testid]")).toBeNull();
	});

	it("shows SCORE only when score > 0", () => {
		render(<RunReadout score={150} secrets={0} levelsCleared={0} />);
		expect(screen.getByTestId("bonebuster-score").textContent).toContain("150");
		expect(screen.queryByTestId("bonebuster-secrets")).toBeNull();
		expect(screen.queryByTestId("bonebuster-prestige")).toBeNull();
	});

	it("shows SECRETS only when secrets > 0", () => {
		render(<RunReadout score={0} secrets={3} levelsCleared={0} />);
		expect(screen.getByTestId("bonebuster-secrets").textContent).toContain("3");
		expect(screen.queryByTestId("bonebuster-prestige")).toBeNull();
	});

	it("hides PRESTIGE below the first interval, shows tier 1 at the interval", () => {
		const { rerender } = render(
			<RunReadout score={0} secrets={0} levelsCleared={PRESTIGE_INTERVAL - 1} />,
		);
		expect(screen.queryByTestId("bonebuster-prestige")).toBeNull();

		rerender(<RunReadout score={0} secrets={0} levelsCleared={PRESTIGE_INTERVAL} />);
		expect(screen.getByTestId("bonebuster-prestige").textContent).toContain("PRESTIGE 1");
	});

	it("shows tier 2 after two intervals", () => {
		render(<RunReadout score={0} secrets={0} levelsCleared={PRESTIGE_INTERVAL * 2} />);
		expect(screen.getByTestId("bonebuster-prestige").textContent).toContain("PRESTIGE 2");
	});

	it("renders all three chips together when every value is set", () => {
		render(<RunReadout score={42} secrets={1} levelsCleared={PRESTIGE_INTERVAL} />);
		expect(screen.getByTestId("bonebuster-score")).toBeDefined();
		expect(screen.getByTestId("bonebuster-secrets")).toBeDefined();
		expect(screen.getByTestId("bonebuster-prestige")).toBeDefined();
	});
});
