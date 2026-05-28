/**
 * CR-R1 — DamageNumberField fixed-slot pool. The old impl called a no-op
 * setState (`force`) every frame so the .map() re-ran and recomputed
 * position/opacity/scale, re-instantiating troika SDF text at frame cadence.
 * Now a fixed MAX_NUMBERS pool is mounted ONCE and the frame loop drives
 * each slot's group.position + visible + text opacity imperatively; React
 * only re-renders on spawn/despawn/merge (the slot↔number assignment).
 *
 * This pins the observable contract: a fixed pool of hidden slots that
 * become visible + move when a damageNumber fires, and that DON'T trigger
 * a React commit on every animation frame.
 */

import { dispatch } from "@engine/events";
import { Canvas, useThree } from "@react-three/fiber";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import type * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DamageNumberField } from "../../scene/effects/DamageNumberField";

let clock = 0;
beforeEach(() => {
	clock = 0;
	vi.spyOn(performance, "now").mockImplementation(() => clock);
});
afterEach(() => {
	vi.restoreAllMocks();
	cleanup();
});

function Capture({
	onReady,
}: {
	onReady: (advance: (t: number) => void, scene: THREE.Scene) => void;
}) {
	const advance = useThree((s) => s.advance);
	const scene = useThree((s) => s.scene);
	useEffect(() => {
		onReady(advance, scene);
	}, [advance, onReady, scene]);
	return null;
}

async function mount() {
	let advance!: (t: number) => void;
	let scene!: THREE.Scene;
	render(
		<Canvas frameloop="never">
			<Capture
				onReady={(a, s) => {
					advance = a;
					scene = s;
				}}
			/>
			<DamageNumberField />
		</Canvas>,
	);
	await vi.waitFor(() => {
		if (!scene) throw new Error("scene not ready");
	});
	// A slot group is a group whose DIRECT children are drei <Text> (troika
	// text-mesh objects expose a `.text` string field) — distinguishes them
	// from the wrapper group (whose children are themselves groups).
	const isSlotGroup = (o: THREE.Object3D): boolean =>
		(o as THREE.Group).isGroup &&
		o.children.length >= 2 &&
		o.children.every((c) => typeof (c as unknown as { text?: unknown }).text === "string");
	const slotGroups = (): THREE.Object3D[] => {
		const out: THREE.Object3D[] = [];
		scene.traverse((o) => {
			if (isSlotGroup(o)) out.push(o);
		});
		return out;
	};
	// Wait until the DamageNumberField's fixed slot pool has mounted (troika
	// <Text> children attach asynchronously) so the first dispatch+step finds
	// bound slot refs — otherwise the test races the field's first commit.
	await vi.waitFor(() => {
		if (slotGroups().length < 1) throw new Error("slot pool not mounted yet");
	});
	return {
		step: (ms: number) => advance(ms / 1000),
		visibleSlotCount: () => slotGroups().filter((o) => o.visible).length,
		firstVisibleSlot: (): THREE.Object3D | null => slotGroups().find((o) => o.visible) ?? null,
	};
}

describe("CR-R1 — DamageNumberField fixed-slot pool", () => {
	it("starts with no visible slots, shows one when a damage number fires, hides it after TTL", async () => {
		const driver = await mount();
		driver.step(16);
		expect(driver.visibleSlotCount()).toBe(0); // all slots hidden initially

		dispatch({ type: "damageNumber", x: 2, y: 3, amount: 42, killed: false, enemyId: 7 });
		driver.step(16); // assign + first imperative update
		expect(driver.visibleSlotCount()).toBe(1);

		clock = 2000; // past TTL_MS (1000)
		driver.step(16); // despawn
		expect(driver.visibleSlotCount()).toBe(0);
	});

	it("floats the number upward over its lifetime (imperative position drive)", async () => {
		const driver = await mount();
		dispatch({ type: "damageNumber", x: 0, y: 0, amount: 10, killed: false, enemyId: 1 });
		driver.step(16);
		// Hold the SAME slot object across both reads (avoids any traverse
		// race) and assert its y rises as the number floats up.
		const slot = driver.firstVisibleSlot();
		expect(slot).not.toBeNull();
		const y0 = (slot as THREE.Object3D).position.y;
		clock = 400; // ~40% through the 1000ms life — should have lifted
		driver.step(16);
		const y1 = (slot as THREE.Object3D).position.y;
		// lift = age * floatSpeed * (TTL/1000); strictly increasing.
		expect(y1).toBeGreaterThan(y0);
	});
});
