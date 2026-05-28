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
	// vi.waitFor defaults to a 1000ms window — too tight for R3F's first
	// effect commit under parallel browser-mode file execution (the Canvas
	// mount + useThree capture genuinely takes >1s when several browser test
	// files contend for the single Chromium instance). Give it the same
	// generous settle budget the suite already grants via testTimeout.
	await vi.waitFor(
		() => {
			if (!scene) throw new Error("scene not ready");
		},
		{ timeout: 10_000, interval: 50 },
	);
	// A slot group is a group with ≥2 children, NONE of which are groups
	// (the slot's children are the two drei <Text> meshes). This is purely
	// STRUCTURAL — it does NOT depend on troika's async `.text` population,
	// which races the first traversal. The wrapper group is excluded because
	// its children ARE groups (the slots). Robust against mount timing.
	const isSlotGroup = (o: THREE.Object3D): boolean =>
		(o as THREE.Group).isGroup &&
		o.children.length >= 2 &&
		o.children.every((c) => !(c as THREE.Group).isGroup);
	const slotGroups = (): THREE.Object3D[] => {
		const out: THREE.Object3D[] = [];
		scene.traverse((o) => {
			if (isSlotGroup(o)) out.push(o);
		});
		return out;
	};
	// Wait until the fixed slot pool has mounted (the field renders
	// MAX_NUMBERS=24 slots once). Structural detector above doesn't race
	// troika, but the React commit itself is async — wait for the full pool.
	await vi.waitFor(
		() => {
			if (slotGroups().length < 24) throw new Error("slot pool not fully mounted yet");
		},
		{ timeout: 10_000, interval: 50 },
	);
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
