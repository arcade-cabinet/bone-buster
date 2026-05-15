/**
 * ARCH1a — typed event-bus contract.
 *
 * Pins the round-trip: dispatch(typed event) → addObjexoomListener(K, h)
 * produces a payload narrowed to EventOf<K>. Also pins that the wire
 * format (CustomEvent.detail) doesn't accidentally include `type`,
 * because that would conflict with the event-name encoding.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
	addObjexoomListener,
	type BurstEvent,
	dispatch,
	type FpsUpdateEvent,
	type ObjexoomEvent,
} from "../../events";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ARCH1a — typed event dispatch round-trip", () => {
	it("dispatch + addObjexoomListener round-trips a BurstEvent", () => {
		const received: BurstEvent[] = [];
		const teardown = addObjexoomListener("burst", (e) => received.push(e));
		const out: BurstEvent = { type: "burst", x: 1.2, y: 3.4, kind: "damage" };
		dispatch(out);
		teardown();
		expect(received).toHaveLength(1);
		expect(received[0]).toEqual(out);
	});

	it("dispatch + addObjexoomListener round-trips an FpsUpdateEvent", () => {
		const received: FpsUpdateEvent[] = [];
		const teardown = addObjexoomListener("fpsUpdate", (e) => received.push(e));
		dispatch({ type: "fpsUpdate", fps: 144, pixelRatio: 1.5 });
		teardown();
		expect(received).toHaveLength(1);
		expect(received[0].type).toBe("fpsUpdate");
		expect(received[0].fps).toBe(144);
		expect(received[0].pixelRatio).toBe(1.5);
	});

	it("returned teardown removes the listener", () => {
		let count = 0;
		const teardown = addObjexoomListener("fire", () => {
			count += 1;
		});
		dispatch({ type: "fire" });
		expect(count).toBe(1);
		teardown();
		dispatch({ type: "fire" });
		// No further increments after teardown.
		expect(count).toBe(1);
	});

	it("only listeners of the matching type receive the event", () => {
		let burstHits = 0;
		let fireHits = 0;
		const t1 = addObjexoomListener("burst", () => {
			burstHits += 1;
		});
		const t2 = addObjexoomListener("fire", () => {
			fireHits += 1;
		});
		dispatch({ type: "burst", x: 0, y: 0, kind: "pickup" });
		dispatch({ type: "fire" });
		t1();
		t2();
		expect(burstHits).toBe(1);
		expect(fireHits).toBe(1);
	});

	it("wire format: CustomEvent.detail omits the discriminator `type`", () => {
		// The discriminator lives in the event NAME (`objexoom:burst`),
		// not the detail payload. Existing untyped consumers read
		// `e.detail.x` directly — leaking a `type` field into detail
		// would shadow that contract.
		let captured: unknown = null;
		const adapter = (e: Event) => {
			captured = (e as CustomEvent).detail;
		};
		window.addEventListener("objexoom:burst", adapter);
		dispatch({ type: "burst", x: 5, y: 6, kind: "explode" });
		window.removeEventListener("objexoom:burst", adapter);
		expect(captured).toEqual({ x: 5, y: 6, kind: "explode" });
		expect(captured).not.toHaveProperty("type");
	});

	it("backward compatibility: typed dispatch reaches untyped window listener", () => {
		// Existing untyped sites use `window.addEventListener("objexoom:X", h)`
		// and read `e.detail.foo`. Typed dispatch must keep that shape so
		// ARCH1b can migrate call sites incrementally without flipping
		// every consumer in lockstep.
		let detail: unknown = null;
		const adapter = (e: Event) => {
			detail = (e as CustomEvent).detail;
		};
		window.addEventListener("objexoom:shellEject", adapter);
		const evt: ObjexoomEvent = {
			type: "shellEject",
			x: 1,
			y: 2,
			z: 3,
			vx: 0.1,
			vy: 0.2,
			vz: 0.3,
			scale: 0.6,
		};
		dispatch(evt);
		window.removeEventListener("objexoom:shellEject", adapter);
		expect(detail).toEqual({ x: 1, y: 2, z: 3, vx: 0.1, vy: 0.2, vz: 0.3, scale: 0.6 });
	});

	it("backward compatibility: untyped dispatch reaches typed listener", () => {
		// Inverse direction: existing call sites still doing the manual
		// `window.dispatchEvent(new CustomEvent(...))` pattern must reach
		// new typed listeners during the rolling migration.
		const received: BurstEvent[] = [];
		const teardown = addObjexoomListener("burst", (e) => received.push(e));
		window.dispatchEvent(
			new CustomEvent("objexoom:burst", {
				detail: { x: 9, y: 8, kind: "playerHit" },
			}),
		);
		teardown();
		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({ type: "burst", x: 9, y: 8, kind: "playerHit" });
	});
});

describe("E8 step-2 — flameStream BurstKind", () => {
	it("BurstEvent.kind includes 'flameStream' and carries optional dirX/dirY", () => {
		const received: BurstEvent[] = [];
		const teardown = addObjexoomListener("burst", (e) => received.push(e));
		dispatch({
			type: "burst",
			kind: "flameStream",
			x: 5,
			y: 10,
			dirX: 0.7,
			dirY: 0.7,
		});
		teardown();
		expect(received).toHaveLength(1);
		expect(received[0].kind).toBe("flameStream");
		expect(received[0].dirX).toBeCloseTo(0.7);
		expect(received[0].dirY).toBeCloseTo(0.7);
	});

	it("other BurstKind events work without dirX/dirY (back-compat)", () => {
		const received: BurstEvent[] = [];
		const teardown = addObjexoomListener("burst", (e) => received.push(e));
		dispatch({ type: "burst", kind: "damage", x: 1, y: 2 });
		teardown();
		expect(received[0].kind).toBe("damage");
		expect(received[0].dirX).toBeUndefined();
		expect(received[0].dirY).toBeUndefined();
	});
});
