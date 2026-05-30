/**
 * PREP-BP2 — assertNever exhaustiveness guard.
 *
 * The compile-time guarantee (an unhandled union variant becomes a build error)
 * is exercised by gameReducer.ts / useGameRef.ts using it in their `default`
 * arms — tsc fails the build if a variant is added without a case. Here we pin
 * the runtime backstop: an impossible value that slips past the type system
 * (e.g. malformed deserialized data) throws with a useful, context-tagged
 * message rather than silently no-op'ing.
 */

import { assertNever } from "@shared/assertNever";
import { describe, expect, it } from "vitest";

describe("PREP-BP2 — assertNever", () => {
	it("throws including the offending value and the context label", () => {
		// `as never` mimics a value that escaped the type system at a boundary.
		expect(() => assertNever("ghost" as never, "GameAction")).toThrow(
			/Unhandled GameAction: "ghost"/,
		);
	});

	it("defaults the context label to 'value'", () => {
		expect(() => assertNever(42 as never)).toThrow(/Unhandled value: 42/);
	});

	it("serializes object-shaped variants in the message", () => {
		expect(() => assertNever({ type: "unknown" } as never, "GameEffect")).toThrow(
			/Unhandled GameEffect: \{"type":"unknown"\}/,
		);
	});
});
