/**
 * CR-F6 — the URL-flag parsers are the ONLY external-input boundary in the
 * app (a victim opens an attacker-crafted `?bonebusterSeed=…` URL), so the
 * parse rules are security-load-bearing and pinned here. Pure `*FromHref`
 * forms take an href string — no window stubbing needed.
 */

import {
	captureModeEnabled,
	hasDebugFlagInHref,
	parseArchetypeFromHref,
	parseSeedFromHref,
} from "@views/urlFlags";
import { afterEach, describe, expect, it, vi } from "vitest";

const U = (qs: string) => `https://example.test/${qs}`;

describe("CR-F6 — parseSeedFromHref", () => {
	it.each([
		["?bonebusterSeed=12345", 12345],
		["?bonebusterSeed=0", 0],
		["?objexoomSeed=777", 777], // legacy alias accepted
	])("accepts a decimal seed %s → %s", (qs, expected) => {
		expect(parseSeedFromHref(U(qs))).toBe(expected);
	});

	it("masks via signed 32-bit & (mulberry32 does >>>0 downstream)", () => {
		// JS `& 0xffffffff` is a SIGNED 32-bit op: high-bit values come back
		// negative. That's fine — mulberry32 applies `seed >>> 0` internally,
		// so the actual PRNG seed is unsigned. We just pin the documented
		// boundary behavior of the parser here.
		expect(parseSeedFromHref(U("?bonebusterSeed=4294967296"))).toBe(0); // 2^32 → 0
		expect(parseSeedFromHref(U("?bonebusterSeed=4294967295"))).toBe(-1); // 2^32-1 → -1 (signed)
	});

	it.each([
		["?bonebusterSeed=-5", "negative"],
		["?bonebusterSeed=0xff", "hex"],
		["?bonebusterSeed=1e9", "scientific"],
		["?bonebusterSeed=12.5", "float"],
		["?bonebusterSeed=abc", "non-numeric"],
		["?bonebusterSeed=", "empty"],
		["?bonebusterSeed=12345abc", "trailing junk"],
		["", "absent"],
	])("rejects %s (%s) → null", (qs) => {
		expect(parseSeedFromHref(U(qs))).toBeNull();
	});

	it("prefers the canonical name when both are present", () => {
		expect(parseSeedFromHref(U("?bonebusterSeed=1&objexoomSeed=2"))).toBe(1);
	});

	it("returns null on an unparseable href instead of throwing", () => {
		expect(parseSeedFromHref("::::not a url")).toBeNull();
	});
});

describe("CR-F6 — parseArchetypeFromHref", () => {
	it("reads the canonical + legacy names, canonical wins", () => {
		expect(parseArchetypeFromHref(U("?bonebusterArchetype=arena"))).toBe("arena");
		expect(parseArchetypeFromHref(U("?objexoomArchetype=sewer"))).toBe("sewer");
		expect(parseArchetypeFromHref(U("?bonebusterArchetype=a&objexoomArchetype=b"))).toBe("a");
	});

	it("returns null when absent", () => {
		expect(parseArchetypeFromHref(U(""))).toBeNull();
	});
});

describe("CR-F6 — hasDebugFlagInHref", () => {
	it("detects either flag spelling", () => {
		expect(hasDebugFlagInHref(U("?bonebusterDebug"))).toBe(true);
		expect(hasDebugFlagInHref(U("?objexoomDebug"))).toBe(true);
		expect(hasDebugFlagInHref(U("?other=1"))).toBe(false);
		expect(hasDebugFlagInHref(U(""))).toBe(false);
	});
});

describe("VIS-AUTO — captureModeEnabled", () => {
	const setHref = (href: string) => {
		vi.stubGlobal("window", { location: { href } });
	};
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("tracks the debug flag from the live URL", () => {
		setHref(U("?bonebusterDebug"));
		expect(captureModeEnabled()).toBe(true);
		setHref(U("?objexoomDebug"));
		expect(captureModeEnabled()).toBe(true);
		setHref(U("?other=1"));
		expect(captureModeEnabled()).toBe(false);
	});

	it("is NOT gated on NODE_ENV — capture mode works on the production build", () => {
		// The post-deploy Pages smoke test runs the production bundle with
		// ?bonebusterDebug and still needs a readable drawing buffer, so unlike
		// debugHooksEnabled this MUST stay true in production.
		const prev = process.env.NODE_ENV;
		try {
			vi.stubEnv("NODE_ENV", "production");
			setHref(U("?bonebusterDebug"));
			expect(captureModeEnabled()).toBe(true);
		} finally {
			vi.unstubAllEnvs();
			if (prev !== undefined) process.env.NODE_ENV = prev;
		}
	});

	it("returns false when window is undefined (SSR)", () => {
		vi.stubGlobal("window", undefined);
		expect(captureModeEnabled()).toBe(false);
	});
});
