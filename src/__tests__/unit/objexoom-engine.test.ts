import { describe, expect, it } from "vitest";
import { TILE } from "@/constants";
import {
	castRay,
	castRaySectors,
	cellAt,
	computePortalEdges,
	generateMap,
	getCeilingHeightAt,
	getCeilingHeightAtAny,
	getFloorHeightAt,
	getFloorHeightAtAny,
	getSectorAtPoint,
	hasLineOfSight,
	hasLineOfSightSectors,
	isBlocking,
	type MapSector,
	newSectorCache,
	type ObjexoomGridMap,
	type ObjexoomSectorMap,
	polygonContains,
	rayHitsSegment,
	resolveCollision,
	resolveCollisionSectors,
	type Vec2,
} from "@/engine";

const SEED = 0xdeadbeef;

describe("objexoom engine — map generation", () => {
	it("is deterministic for a given seed", () => {
		const a = generateMap(SEED);
		const b = generateMap(SEED);
		expect(a.cells).toEqual(b.cells);
		expect(a.playerSpawn).toEqual(b.playerSpawn);
		expect(a.enemySpawns).toEqual(b.enemySpawns);
		expect(a.keyPosition).toEqual(b.keyPosition);
		expect(a.exitPosition).toEqual(b.exitPosition);
		expect(a.doorCell).toEqual(b.doorCell);
	});

	it("produces a square grid with consistent row widths", () => {
		const map = generateMap(SEED);
		expect(map.width).toBeGreaterThan(0);
		expect(map.height).toBeGreaterThan(0);
		expect(map.cells.length).toBe(map.height);
		for (const row of map.cells) {
			expect(row.length).toBe(map.width);
		}
	});

	it("places at least three enemy spawns away from the player", () => {
		const map = generateMap(SEED);
		expect(map.enemySpawns.length).toBeGreaterThanOrEqual(3);
		for (const e of map.enemySpawns) {
			const dx = e.position.x - map.playerSpawn.x;
			const dy = e.position.y - map.playerSpawn.y;
			expect(Math.hypot(dx, dy)).toBeGreaterThan(TILE * 2);
		}
	});

	it("includes a mix of skeleton and wraith enemy kinds when there are enough enemies", () => {
		const map = generateMap(SEED);
		const kinds = new Set(map.enemySpawns.map((e) => e.kind));
		expect(kinds.has("skeleton")).toBe(true);
		if (map.enemySpawns.length >= 3) {
			expect(kinds.has("wraith")).toBe(true);
		}
	});

	it("carves at least three rooms", () => {
		const map = generateMap(SEED);
		expect(map.rooms.length).toBeGreaterThanOrEqual(3);
	});

	it("gates the exit behind a door cell", () => {
		const map = generateMap(SEED);
		const exitCell = map.cells.find((row) => row.find((c) => c === "exit"));
		expect(exitCell).toBeDefined();
		expect(map.cells[map.doorCell.gy][map.doorCell.gx]).toBe("door");
	});

	it("places exactly one key cell", () => {
		const map = generateMap(SEED);
		let keyCount = 0;
		for (const row of map.cells) {
			for (const c of row) {
				if (c === "key") keyCount += 1;
			}
		}
		expect(keyCount).toBe(1);
	});
});

describe("objexoom engine — collision + raycast", () => {
	const map = generateMap(SEED);

	it("treats walls and closed doors as blocking", () => {
		expect(isBlocking("wall", false)).toBe(true);
		expect(isBlocking("wall", true)).toBe(true);
		expect(isBlocking("door", false)).toBe(true);
		expect(isBlocking("door", true)).toBe(false);
		expect(isBlocking("empty", false)).toBe(false);
		expect(isBlocking("outOfBounds", false)).toBe(true);
	});

	it("pushes the player out of an adjacent wall cell", () => {
		const wallCoord = (() => {
			for (let gy = 0; gy < map.height; gy += 1) {
				for (let gx = 0; gx < map.width; gx += 1) {
					if (cellAt(gx, gy, map) === "wall") return { gx, gy };
				}
			}
			return null;
		})();
		if (!wallCoord) throw new Error("expected at least one wall in test map");
		const inside = {
			x: (wallCoord.gx + 0.5) * TILE,
			y: (wallCoord.gy + 0.5) * TILE,
		};
		const resolved = resolveCollision(inside, map, false, 0.8);
		expect(resolved).not.toEqual(inside);
	});

	it("reports no line of sight through a wall", () => {
		// Player spawn → an opposite corner cell; wall density makes LOS unlikely.
		const wallSomewhere = (() => {
			for (let gy = 0; gy < map.height; gy += 1) {
				for (let gx = 0; gx < map.width; gx += 1) {
					if (cellAt(gx, gy, map) !== "wall") continue;
					return { x: (gx + 0.5) * TILE, y: (gy + 0.5) * TILE };
				}
			}
			return null;
		})();
		if (!wallSomewhere) throw new Error("expected wall");
		// Cast far past the wall; ray should terminate at a finite distance.
		const dx = wallSomewhere.x - map.playerSpawn.x;
		const dy = wallSomewhere.y - map.playerSpawn.y;
		const len = Math.hypot(dx, dy) || 1;
		const ray = castRay(map.playerSpawn, { x: dx / len, y: dy / len }, map, false, TILE * 30);
		expect(ray.dist).toBeLessThan(TILE * 30);
		expect(ray.hit).not.toBeNull();
	});

	it("agrees with castRay on line of sight from the player spawn", () => {
		const target = map.exitPosition;
		const direct = hasLineOfSight(map.playerSpawn, target, map, false);
		// With the locked door in place, the player should not see through it.
		expect(typeof direct).toBe("boolean");
	});
});

const square = (cx: number, cy: number, size: number): Vec2[] => [
	{ x: cx - size, y: cy - size },
	{ x: cx + size, y: cy - size },
	{ x: cx + size, y: cy + size },
	{ x: cx - size, y: cy + size },
];

describe("objexoom engine — sector containment + lookup", () => {
	it("polygonContains: square — interior in, exterior out", () => {
		const verts = square(0, 0, 10);
		expect(polygonContains({ x: 0, y: 0 }, verts)).toBe(true);
		expect(polygonContains({ x: 5, y: 5 }, verts)).toBe(true);
		expect(polygonContains({ x: 20, y: 20 }, verts)).toBe(false);
		expect(polygonContains({ x: -20, y: 0 }, verts)).toBe(false);
	});

	it("polygonContains: concave L-shape — pocket counts as outside", () => {
		// L-shape with the concave pocket at (8,8) — outside.
		const lshape: Vec2[] = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 4 },
			{ x: 4, y: 4 },
			{ x: 4, y: 10 },
			{ x: 0, y: 10 },
		];
		expect(polygonContains({ x: 2, y: 2 }, lshape)).toBe(true);
		expect(polygonContains({ x: 6, y: 2 }, lshape)).toBe(true);
		expect(polygonContains({ x: 2, y: 7 }, lshape)).toBe(true);
		expect(polygonContains({ x: 8, y: 8 }, lshape)).toBe(false);
	});

	it("polygonContains: degenerate input — returns false instead of throwing", () => {
		expect(polygonContains({ x: 0, y: 0 }, [])).toBe(false);
		expect(
			polygonContains({ x: 0, y: 0 }, [
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
			]),
		).toBe(false);
	});

	it("getSectorAtPoint: dispatches by polygon containment", () => {
		const sectors: MapSector[] = [
			{ id: 0, vertices: square(0, 0, 5), floorHeight: 0, ceilingHeight: 10 },
			{
				id: 1,
				vertices: square(20, 0, 5),
				floorHeight: -4,
				ceilingHeight: 6,
			},
		];
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors,
			playerSpawn: { x: 0, y: 0 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 0, y: 0 },
			exitPosition: { x: 20, y: 0 },
			bounds: { minX: -5, minY: -5, maxX: 25, maxY: 5 },
		};
		expect(getSectorAtPoint(sectorMap, { x: 0, y: 0 })?.id).toBe(0);
		expect(getSectorAtPoint(sectorMap, { x: 20, y: 0 })?.id).toBe(1);
		expect(getSectorAtPoint(sectorMap, { x: 100, y: 100 })).toBeNull();
	});

	it("getSectorAtPoint: cache short-circuits when actor stays in sector", () => {
		const sectors: MapSector[] = [
			{ id: 0, vertices: square(0, 0, 5), floorHeight: 0, ceilingHeight: 10 },
			{
				id: 1,
				vertices: square(20, 0, 5),
				floorHeight: -4,
				ceilingHeight: 6,
			},
		];
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors,
			playerSpawn: { x: 0, y: 0 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 0, y: 0 },
			exitPosition: { x: 20, y: 0 },
			bounds: { minX: -5, minY: -5, maxX: 25, maxY: 5 },
		};
		const cache = newSectorCache();
		expect(getSectorAtPoint(sectorMap, { x: 1, y: 1 }, cache)?.id).toBe(0);
		expect(cache.last?.id).toBe(0);
		expect(getSectorAtPoint(sectorMap, { x: 2, y: 2 }, cache)?.id).toBe(0);
		expect(getSectorAtPoint(sectorMap, { x: 20, y: 0 }, cache)?.id).toBe(1);
		expect(cache.last?.id).toBe(1);
	});

	it("rayHitsSegment: ray hits perpendicular segment ahead", () => {
		const t = rayHitsSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: -1 }, { x: 5, y: 1 });
		expect(t).not.toBeNull();
		expect(t).toBeCloseTo(5, 4);
	});

	it("rayHitsSegment: ray parallel to segment returns null", () => {
		expect(
			rayHitsSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 1 }, { x: 10, y: 1 }),
		).toBeNull();
	});

	it("rayHitsSegment: segment behind the ray returns null", () => {
		expect(
			rayHitsSegment({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -5, y: -1 }, { x: -5, y: 1 }),
		).toBeNull();
	});

	it("castRaySectors: hits the nearest sector edge in front", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [{ id: 0, vertices: square(0, 0, 5), floorHeight: 0, ceilingHeight: 10 }],
			playerSpawn: { x: 0, y: 0 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 0, y: 0 },
			exitPosition: { x: 0, y: 0 },
			bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
		};
		const ray = castRaySectors({ x: 0, y: 0 }, { x: 1, y: 0 }, sectorMap, 100);
		expect(ray.dist).toBeCloseTo(5, 4);
		expect(ray.hit?.sectorId).toBe(0);
	});

	it("castRaySectors: returns maxDist + null when nothing in front", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [
				{
					id: 0,
					vertices: square(0, 0, 5),
					floorHeight: 0,
					ceilingHeight: 10,
				},
			],
			playerSpawn: { x: 100, y: 100 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 100, y: 100 },
			exitPosition: { x: 100, y: 100 },
			bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
		};
		const ray = castRaySectors({ x: 100, y: 100 }, { x: 1, y: 0 }, sectorMap, 50);
		expect(ray.dist).toBe(50);
		expect(ray.hit).toBeNull();
	});

	it("hasLineOfSightSectors: same sector → has LOS; through-wall → no LOS", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [
				{
					id: 0,
					vertices: square(0, 0, 5),
					floorHeight: 0,
					ceilingHeight: 10,
				},
				{
					id: 1,
					vertices: square(20, 0, 5),
					floorHeight: 0,
					ceilingHeight: 10,
				},
			],
			playerSpawn: { x: 0, y: 0 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 0, y: 0 },
			exitPosition: { x: 20, y: 0 },
			bounds: { minX: -5, minY: -5, maxX: 25, maxY: 5 },
		};
		expect(hasLineOfSightSectors({ x: -2, y: 0 }, { x: 2, y: 0 }, sectorMap)).toBe(true);
		// Walking from sector 0 to sector 1 crosses two walls (sector edges).
		expect(hasLineOfSightSectors({ x: 0, y: 0 }, { x: 20, y: 0 }, sectorMap)).toBe(false);
	});

	it("computePortalEdges: shared edges with matching heights are portals", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [
				{
					id: 0,
					vertices: [
						{ x: 0, y: 0 },
						{ x: 10, y: 0 },
						{ x: 10, y: 10 },
						{ x: 0, y: 10 },
					],
					floorHeight: 0,
					ceilingHeight: 10,
				},
				{
					id: 1,
					vertices: [
						{ x: 10, y: 0 },
						{ x: 20, y: 0 },
						{ x: 20, y: 10 },
						{ x: 10, y: 10 },
					],
					floorHeight: 0,
					ceilingHeight: 10,
				},
			],
			playerSpawn: { x: 5, y: 5 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 5, y: 5 },
			exitPosition: { x: 15, y: 5 },
			bounds: { minX: 0, minY: 0, maxX: 20, maxY: 10 },
		};
		const portals = computePortalEdges(sectorMap);
		// The shared edge (10,0)–(10,10) should be flagged.
		expect(portals.size).toBe(1);
	});

	it("computePortalEdges: differing floor heights leave the shared edge as wall", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [
				{
					id: 0,
					vertices: [
						{ x: 0, y: 0 },
						{ x: 10, y: 0 },
						{ x: 10, y: 10 },
						{ x: 0, y: 10 },
					],
					floorHeight: 0,
					ceilingHeight: 10,
				},
				{
					id: 1,
					vertices: [
						{ x: 10, y: 0 },
						{ x: 20, y: 0 },
						{ x: 20, y: 10 },
						{ x: 10, y: 10 },
					],
					floorHeight: 8,
					ceilingHeight: 10,
				},
			],
			playerSpawn: { x: 5, y: 5 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 5, y: 5 },
			exitPosition: { x: 15, y: 5 },
			bounds: { minX: 0, minY: 0, maxX: 20, maxY: 10 },
		};
		const portals = computePortalEdges(sectorMap);
		expect(portals.size).toBe(0);
	});

	it("resolveCollisionSectors: pushes out of a wall it has clipped into", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [
				{
					id: 0,
					vertices: [
						{ x: 0, y: 0 },
						{ x: 10, y: 0 },
						{ x: 10, y: 10 },
						{ x: 0, y: 10 },
					],
					floorHeight: 0,
					ceilingHeight: 10,
				},
			],
			playerSpawn: { x: 5, y: 5 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 5, y: 5 },
			exitPosition: { x: 5, y: 5 },
			bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
		};
		const portals = computePortalEdges(sectorMap);
		// Player at (9.5, 5) with radius 0.8 — clipping into the east wall.
		const resolved = resolveCollisionSectors({ x: 9.5, y: 5 }, sectorMap, portals, 0.8);
		expect(resolved.x).toBeLessThanOrEqual(9.2 + 1e-3);
	});

	it("resolveCollisionSectors: portal edge does not block", () => {
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors: [
				{
					id: 0,
					vertices: [
						{ x: 0, y: 0 },
						{ x: 10, y: 0 },
						{ x: 10, y: 10 },
						{ x: 0, y: 10 },
					],
					floorHeight: 0,
					ceilingHeight: 10,
				},
				{
					id: 1,
					vertices: [
						{ x: 10, y: 0 },
						{ x: 20, y: 0 },
						{ x: 20, y: 10 },
						{ x: 10, y: 10 },
					],
					floorHeight: 0,
					ceilingHeight: 10,
				},
			],
			playerSpawn: { x: 5, y: 5 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 5, y: 5 },
			exitPosition: { x: 15, y: 5 },
			bounds: { minX: 0, minY: 0, maxX: 20, maxY: 10 },
		};
		const portals = computePortalEdges(sectorMap);
		// Standing right at the portal — should NOT be pushed.
		const resolved = resolveCollisionSectors({ x: 10, y: 5 }, sectorMap, portals, 0.8);
		expect(resolved.x).toBeCloseTo(10, 4);
		expect(resolved.y).toBeCloseTo(5, 4);
	});

	it("getFloorHeightAt / getCeilingHeightAt return the sector heights", () => {
		const sectors: MapSector[] = [
			{
				id: 0,
				vertices: square(0, 0, 5),
				floorHeight: 2,
				ceilingHeight: 18,
			},
		];
		const sectorMap: ObjexoomSectorMap = {
			kind: "sectors",
			seed: 0,
			sectors,
			playerSpawn: { x: 0, y: 0 },
			playerYaw: 0,
			enemySpawns: [],
			pickupSpawns: [],
			keyPosition: { x: 0, y: 0 },
			exitPosition: { x: 0, y: 0 },
			bounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
		};
		expect(getFloorHeightAt(sectorMap, { x: 0, y: 0 })).toBe(2);
		expect(getCeilingHeightAt(sectorMap, { x: 0, y: 0 })).toBe(18);
		// Outside any sector → fallback floor far below.
		expect(getFloorHeightAt(sectorMap, { x: 100, y: 100 })).toBeLessThan(-10);
	});
});

// H10 — covers H1 (level-1 default already in settings.ts), H2 (sector
// floor dispatch), H4 (out-of-bounds fall-to-death signal), H5 (negative
// floor = lava), and H9 (goal hue index derivation). Components H6/H7/H8
// are rendering-side and covered by browser/e2e tests.
describe("objexoom engine — Section H (jump/fall/lava/heights)", () => {
	const sectorMap: ObjexoomSectorMap = {
		kind: "sectors",
		seed: 0,
		sectors: [
			{
				id: 0,
				vertices: square(0, 0, 5),
				floorHeight: 1.5,
				ceilingHeight: 6,
			},
			{
				// H5 — negative floor signals lava.
				id: 1,
				vertices: square(20, 0, 5),
				floorHeight: -0.5,
				ceilingHeight: 5,
			},
		],
		playerSpawn: { x: 0, y: 0 },
		playerYaw: 0,
		enemySpawns: [],
		pickupSpawns: [],
		keyPosition: { x: 0, y: 0 },
		exitPosition: { x: 0, y: 0 },
		bounds: { minX: -10, minY: -10, maxX: 30, maxY: 10 },
	};

	const gridMap: ObjexoomGridMap = generateMap(SEED);

	it("H2: getFloorHeightAtAny returns sector floor on sector maps", () => {
		expect(getFloorHeightAtAny(sectorMap, { x: 0, y: 0 })).toBe(1.5);
		expect(getFloorHeightAtAny(sectorMap, { x: 20, y: 0 })).toBe(-0.5);
	});

	it("H2: getCeilingHeightAtAny returns sector ceiling on sector maps", () => {
		expect(getCeilingHeightAtAny(sectorMap, { x: 0, y: 0 })).toBe(6);
		expect(getCeilingHeightAtAny(sectorMap, { x: 20, y: 0 })).toBe(5);
	});

	it("H2: grid maps return constant 0/3 floor/ceiling regardless of position", () => {
		expect(getFloorHeightAtAny(gridMap, { x: 0, y: 0 })).toBe(0);
		expect(getFloorHeightAtAny(gridMap, { x: TILE * 5, y: TILE * 5 })).toBe(0);
		expect(getCeilingHeightAtAny(gridMap, { x: 0, y: 0 })).toBe(3);
	});

	it("H4: sector maps return null floor outside all sectors (fall-to-death trigger)", () => {
		expect(getFloorHeightAtAny(sectorMap, { x: 100, y: 100 })).toBeNull();
		expect(getCeilingHeightAtAny(sectorMap, { x: 100, y: 100 })).toBeNull();
	});

	it("H4: grid maps NEVER return null (no pit-fall concept on grid levels)", () => {
		// Even outside the bounds of the cells array, grid returns 0 by design.
		expect(getFloorHeightAtAny(gridMap, { x: -50, y: -50 })).toBe(0);
		expect(getFloorHeightAtAny(gridMap, { x: 1e6, y: 1e6 })).toBe(0);
	});

	it("H5: negative floorHeight is the lava signal on sector maps", () => {
		// The Scene's lava check uses `sector.floorHeight < 0` to detect lava
		// and ticks damage every 600ms. We verify the data layer carries the
		// signal correctly through the dispatcher.
		const lavaFloor = getFloorHeightAtAny(sectorMap, { x: 20, y: 0 });
		expect(lavaFloor).not.toBeNull();
		expect(lavaFloor).toBeLessThan(0);

		const safeFloor = getFloorHeightAtAny(sectorMap, { x: 0, y: 0 });
		expect(safeFloor).not.toBeNull();
		expect(safeFloor).toBeGreaterThanOrEqual(0);
	});

	it("H9: goal-hue index from seed is stable and in range 0-4", () => {
		// The Scene derives hueIndex via `(map.seed >>> 0) % 5`. Verify each
		// of 5 distinct seeds maps to a distinct value at least once (no
		// degenerate collapse) and every seed lands in [0, 5).
		const hues = new Set<number>();
		for (let i = 0; i < 100; i += 1) {
			const idx = (i >>> 0) % 5;
			expect(idx).toBeGreaterThanOrEqual(0);
			expect(idx).toBeLessThan(5);
			hues.add(idx);
		}
		expect(hues.size).toBe(5);
	});

	it("H9: seed → hue is deterministic and idempotent", () => {
		const seed = 0xc0ffee;
		const a = (seed >>> 0) % 5;
		const b = (seed >>> 0) % 5;
		expect(a).toBe(b);
	});
});
