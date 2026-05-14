/**
 * Browser smoke tests for the standalone ObjexoomShell.
 *
 * Runs in REAL Chromium via @vitest/browser-playwright with the same
 * ANGLE-GL launch args the e2e screenshot suite uses (default
 * SwiftShader deadlocks on shadow-map composite). No mocks — the
 * Shell, scene, HUD, sfx, GLB loaders, Tone.js, and r3f Canvas all
 * mount for real.
 *
 * Owns:
 *  - Landing renders without throwing (design-tokens typography +
 *    tokens reach the DOM)
 *  - Menu items addressable by role
 *  - Debug-hook gate honored:
 *      no `?objexoomDebug` → no window.__objexoom
 *      with the param      → full hook surface
 *
 * The 3D scene is mounted but offscreen-rendered; we don't assert on
 * pixels here (e2e screenshot suite owns that). What we do assert
 * is that the lifecycle, gating, and component tree are healthy
 * end-to-end.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ObjexoomShell } from "../../ObjexoomShell";

function setSearchParams(qs: string) {
	const url = new URL(window.location.href);
	url.search = qs;
	window.history.replaceState({}, "", url.toString());
}

beforeEach(() => {
	setSearchParams("");
});

afterEach(() => {
	cleanup();
	setSearchParams("");
	delete (window as unknown as { __objexoom?: unknown }).__objexoom;
});

describe("ObjexoomShell — landing surface", () => {
	it("renders the OBJEXOOM wordmark + menu items", async () => {
		render(<ObjexoomShell />);

		// Wordmark — Black Ops One stencil "OBJEXOOM" in the gradient
		// heading. The motion.h1 may split across lines so the role
		// lookup is the stable contract.
		expect(await screen.findByRole("heading", { name: /OBJEXOOM/ })).toBeDefined();

		// All four primary menu items should be addressable by role +
		// accessible name.
		expect(screen.getByRole("button", { name: /NEW GAME/ })).toBeDefined();
		expect(screen.getByRole("button", { name: /OPTIONS/ })).toBeDefined();
		expect(screen.getByRole("button", { name: /HOW TO PLAY/ })).toBeDefined();
		expect(screen.getByRole("button", { name: /QUIT/ })).toBeDefined();
	});

	it("does NOT expose window.__objexoom without the debug query param", async () => {
		render(<ObjexoomShell />);
		await screen.findByRole("heading", { name: /OBJEXOOM/ });
		expect((window as unknown as { __objexoom?: unknown }).__objexoom).toBeUndefined();
	});

	it("exposes the full debug-hook surface when ?objexoomDebug is set", async () => {
		setSearchParams("?objexoomDebug");
		render(<ObjexoomShell />);
		await screen.findByRole("heading", { name: /OBJEXOOM/ });

		const hooks = (
			window as unknown as {
				__objexoom?: {
					getState: () => unknown;
					start: () => void;
					teleport: (x: number, y: number, yawRad?: number) => void;
					fire: () => void;
					killAllEnemies: () => void;
					collectKey: () => void;
					collectAllPickups: () => void;
					triggerWin: () => void;
					forceMissionComplete: () => void;
				};
			}
		).__objexoom;

		expect(hooks).toBeDefined();
		expect(typeof hooks?.getState).toBe("function");
		expect(typeof hooks?.start).toBe("function");
		expect(typeof hooks?.teleport).toBe("function");
		expect(typeof hooks?.fire).toBe("function");
		expect(typeof hooks?.killAllEnemies).toBe("function");
		expect(typeof hooks?.collectKey).toBe("function");
		expect(typeof hooks?.collectAllPickups).toBe("function");
		expect(typeof hooks?.triggerWin).toBe("function");
		expect(typeof hooks?.forceMissionComplete).toBe("function");
	});
});

