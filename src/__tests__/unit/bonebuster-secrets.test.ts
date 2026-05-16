/**
 * E6 — secret switch hit-test + state machine.
 *
 * Pure-math layer (no three.js, no DOM). The fire-resolution branch in
 * src/scene/tick/fireResolution.ts depends on `pickRaySwitch` to
 * prefer switches over barrels and enemies; these tests pin that
 * contract plus the triggered-becomes-inert invariant.
 */

import { loadRefLevel } from "@world/refLevel";
import { pickRaySwitch, type Secret, type SecretSpec, spawnSecrets } from "@world/secrets";
import { describe, expect, it } from "vitest";

function makeSecret(over: Partial<SecretSpec> = {}): Secret {
	const spec: SecretSpec = {
		id: over.id ?? 1,
		switchPosition: over.switchPosition ?? { x: 5, y: 0 },
		switchRadius: over.switchRadius ?? 0.6,
		wallPosition: over.wallPosition ?? { x: 6, y: 0 },
		wallSize: over.wallSize ?? { x: 1.4, z: 0.4 },
		wallRestY: over.wallRestY ?? 1.2,
		wallLiftY: over.wallLiftY ?? 2.4,
	};
	return spawnSecrets([spec])[0];
}

describe("E6 — secret switch hit detection", () => {
	it("ray pointed straight at the switch hits it", () => {
		const secret = makeSecret({ switchPosition: { x: 5, y: 0 } });
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: 1, y: 0 }, [secret], 10);
		expect(hit).not.toBeNull();
		expect(hit?.secret.id).toBe(secret.id);
		expect(hit?.dist).toBeCloseTo(5, 5);
	});

	it("ray pointed at empty space misses", () => {
		const secret = makeSecret({ switchPosition: { x: 5, y: 0 } });
		// Switch is at (5, 0). Aim 90° off — toward (0, 5).
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: 0, y: 1 }, [secret], 10);
		expect(hit).toBeNull();
	});

	it("ray with perp offset just inside switchRadius hits", () => {
		const secret = makeSecret({
			switchPosition: { x: 5, y: 0 },
			switchRadius: 0.6,
		});
		// Aim slightly to the side so perpendicular distance ≈ 0.5 — inside the 0.6 radius.
		const dx = 5;
		const dy = 0.5;
		const len = Math.hypot(dx, dy);
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: dx / len, y: dy / len }, [secret], 10);
		expect(hit).not.toBeNull();
	});

	it("ray with perp offset just outside switchRadius misses", () => {
		const secret = makeSecret({
			switchPosition: { x: 5, y: 0 },
			switchRadius: 0.6,
		});
		// Aim with perp ≈ 1.0 — outside the 0.6 radius.
		const dx = 5;
		const dy = 1.0;
		const len = Math.hypot(dx, dy);
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: dx / len, y: dy / len }, [secret], 10);
		expect(hit).toBeNull();
	});

	it("triggered switches are inert (filtered out)", () => {
		const secret = makeSecret({ switchPosition: { x: 5, y: 0 } });
		secret.triggered = true;
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: 1, y: 0 }, [secret], 10);
		expect(hit).toBeNull();
	});

	it("behind-the-origin switches don't hit", () => {
		const secret = makeSecret({ switchPosition: { x: -5, y: 0 } });
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: 1, y: 0 }, [secret], 10);
		expect(hit).toBeNull();
	});

	it("out-of-range switches don't hit", () => {
		const secret = makeSecret({ switchPosition: { x: 50, y: 0 } });
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: 1, y: 0 }, [secret], 10);
		expect(hit).toBeNull();
	});

	it("picks the closest of two aligned switches", () => {
		const near = makeSecret({ id: 1, switchPosition: { x: 5, y: 0 } });
		const far = makeSecret({ id: 2, switchPosition: { x: 8, y: 0 } });
		const hit = pickRaySwitch({ x: 0, y: 0 }, { x: 1, y: 0 }, [near, far], 20);
		expect(hit?.secret.id).toBe(1);
	});
});

describe("E6 — secret state machine", () => {
	it("spawnSecrets initializes triggered=false and liftProgress=0", () => {
		const secrets = spawnSecrets([
			{
				id: 7,
				switchPosition: { x: 1, y: 2 },
				switchRadius: 0.5,
				wallPosition: { x: 3, y: 4 },
				wallSize: { x: 1, z: 1 },
				wallRestY: 1.2,
				wallLiftY: 2.4,
			},
		]);
		expect(secrets).toHaveLength(1);
		expect(secrets[0].id).toBe(7);
		expect(secrets[0].triggered).toBe(false);
		expect(secrets[0].liftProgress).toBe(0);
	});
});

describe("E6 — ref-level secret synthesis", () => {
	// Loading via the public API to catch regressions in the synthesis
	// formula. Each ref level must carry exactly one secret (the
	// step-1 slice; future multi-secret levels just bump this count).
	for (const idx of [0, 1, 2] as const) {
		it(`ref level ${idx} carries exactly one secret with a unique id`, () => {
			const map = loadRefLevel(idx);
			expect(map.secrets).toBeDefined();
			expect(map.secrets).toHaveLength(1);
			const s = map.secrets?.[0];
			if (!s) throw new Error("unreachable — toHaveLength(1) above guarantees");
			// id encodes the level index so secrets are addressable across reloads.
			expect(s.id).toBe(idx * 100 + 1);
			expect(s.switchRadius).toBeGreaterThan(0);
			expect(s.wallSize.x).toBeGreaterThan(0);
			expect(s.wallSize.z).toBeGreaterThan(0);
		});
	}

	it("secret positions across the 3 ref levels are distinct", () => {
		const positions = [0, 1, 2].map(
			(i) => loadRefLevel(i as 0 | 1 | 2).secrets?.[0].switchPosition,
		);
		// Each level centers at a different place after REF_TO_RUNTIME_SCALE,
		// so the switch positions diverge across levels.
		const seen = new Set(positions.map((p) => `${p?.x.toFixed(2)},${p?.y.toFixed(2)}`));
		expect(seen.size).toBe(3);
	});
});
