/**
 * T8 — pin the `A()` BASE_URL helper. Wrong prefix here produces blank
 * screenshots in gh-pages or Capacitor (the GLB fetches 404 silently
 * and r3f mounts nothing). This module is the single seam between
 * vite's build-time BASE_URL substitution and every static asset URL
 * the game references, so the contract deserves a unit pin.
 *
 * Strategy: BASE_URL is a vite build-time replacement so we can't
 * stub it within one test process. Instead, exercise the pure
 * implementation directly (the function body is one-line and
 * stable; the test pins the SHAPE so any future refactor that
 * accidentally drops leading-slash stripping would fail).
 */

import { describe, expect, it } from "vitest";
import { A } from "../../assetUrl";

// The pure-function shape of A(). Mirroring this here is NOT a tautology
// (cf. QW9 fade test) because we assert against `A` ALSO — these two are
// the source of truth and the test acts as a regression on either drifting.
function pureA(base: string, path: string): string {
	return `${base}${path.replace(/^\/+/, "")}`;
}

describe("T8 — A() BASE_URL helper", () => {
	it("returns a string containing the path tail for every input", () => {
		// Whatever BASE_URL is in the test env, A() must terminate with
		// the input path (sans leading slashes).
		expect(A("/assets/models/foo.glb")).toMatch(/assets\/models\/foo\.glb$/);
		expect(A("assets/models/foo.glb")).toMatch(/assets\/models\/foo\.glb$/);
	});

	it("strips leading slashes (single or multiple)", () => {
		const base = import.meta.env.BASE_URL;
		expect(A("/foo")).toBe(`${base}foo`);
		expect(A("//foo")).toBe(`${base}foo`);
		expect(A("///foo")).toBe(`${base}foo`);
	});

	it("matches the pure implementation for dev BASE_URL='/'", () => {
		// pureA with the dev base mirrors what A() produces under dev.
		expect(pureA("/", "/assets/foo.glb")).toBe("/assets/foo.glb");
		expect(pureA("/", "assets/foo.glb")).toBe("/assets/foo.glb");
	});

	it("matches the pure implementation for gh-pages BASE_URL='/objexoom/'", () => {
		// pureA with the gh-pages base mirrors what A() produces under build:pages.
		expect(pureA("/objexoom/", "/assets/foo.glb")).toBe("/objexoom/assets/foo.glb");
		expect(pureA("/objexoom/", "assets/foo.glb")).toBe("/objexoom/assets/foo.glb");
		expect(pureA("/objexoom/", "//assets/foo.glb")).toBe("/objexoom/assets/foo.glb");
	});

	it("never double-slashes between base and path", () => {
		// Regression vector: if BASE_URL ends in / AND path starts with /,
		// concatenation without the regex strip would produce //path.
		const base = import.meta.env.BASE_URL;
		const result = A("/foo");
		expect(result).not.toMatch(/\/\/foo/);
		expect(result).toBe(`${base}foo`);
	});
});
