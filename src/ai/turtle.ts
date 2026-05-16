/**
 * Port of run_turtle / MapPolygon from the carlini DOOM clone.
 *
 *  Each compressed level is a base64 string. After atob() it becomes a byte
 *  stream of `(3-bit opcode, 5-bit arg)` commands:
 *
 *   000 arg : start a new polygon with `arg` edges following
 *   001 arg : "go" — start a new region by moving (no polygon created)
 *   010 arg : unused
 *   011 arg : place an object indexed by `arg`
 *   100 arg : adjust floor height by `(arg - 15) * 2`
 *   101 arg : adjust ceiling height by `(arg - 15) * 4`
 *   110 arg : pop `arg` entries from the turtle backtrack stack
 *   111 arg : unused
 *
 * Edge bytes encode delta-x and delta-y as `((dx + 7) << 4) | (dy + 7)` where
 * `dx`, `dy` ∈ [-7, 8]. Object bytes encode delta-x/y the same way + a
 * z-offset and 16-step rotation. The compressed values are scaled by 8 to
 * recover world units.
 *
 * This is a faithful structural port. We don't load these maps yet — the
 * Bone Buster shell still uses the procedural grid generator — but exporting a
 * working decoder unblocks the level-progression layer.
 */

const REF_LEVELS = [
	// Level 1 — opening
	"rgt413aHp9UFRwdXm2S6cGajdGc0csIDhMeKwQUngnOne8qtCa19bVwnkHBQZ2LYdcSzFERiVTdZmLd7N3NWfFtGTMrYttSyYil4xasKMDBwscKcTWx9vGJ5cMQDUslqsQiEm3iHe2d4RwnLt8RGZ3YXeGfCjgNz13uQB3OHdqd+RnbPkq0DeDd2ZZ10246xA7d7Nw==",
	// Level 2 — lava
	"ISyRA4qoQGbRdGKrcGV7co0JrseGo4VBdwd3rAOEx4rBBSeCg4eLzAVL26uTRWYjcmQ2cGR6cMGMsgmu445716NQFAfEkQNKKJNiO37CCKSqvG45FHKzwqoC2ihlhnRpknDIjbQIGyc2Y7LEjIzEkQVUVVyquGdDdMONA7CMS2PScJEEo4mXPMEEV6PjTAWMjJNzYMcES2Vikw==",
	// Level 3 — jump down
	"IcCVBWJhZ21sZqd0ZTRxZzpykbMVemdseVdemunnhCVUpppIyYWBcTYzZNxwzK4DB3nnYlF0Ytd8Yt1wkQMHeedmbXFjnnCRAwd555EDB3nnkbQIiIe16RsYJUPEkQcFYZJ2o56NYyV0wgM1bZdldXRkRHDBgIuqA4FHbcGnA6ehF2KJcGKWcJGwBWJAxa6ewpAEKRJT52J9cMGRsQWbKnw2cGK2cMGRA7iOJpG1BzyNq5B1l4LBlgNXeZdjfXBiKHBkTXAh7iGHA6ZUSA==",
	// Level 4 — first real keys
	"Ia2OA7S3KmIKcAMsxsBk23DCjQPCRxtm63JlbXJifXCRBdO0KCpJjQdzoZS7uigqwpEFt1RDB7tmc3TBkKwDhMeKjLIGyLleC8BUwpGqECira1tLGorks6q6pEYThIDEkA1K59bJdCUYZkGzRyrOYppwwrQFMcHZfTtpUXDCAlU3ZalxZLpwy7EGoOXcPgklwZED5ZkKwQShkkk+aUJ1wQOlEklkenDCkasF2p44UzVmpXFlx3Bm6HPCA7aKJ2WWdNuLsQatKwcywOZnWXVmp3BpPnDCmAO8OjRip3BipXBl1HPThqwFJ4KDh4vQrQdsm6eVVlaD",
	// Level 5 — mid
	"IQQhZ5MCkqlmfXFlWnJm2HRnV3JkPHCLqwWZbFojhMKzC325p6aUclB3B3dsYo5wwawDhMeKwQUngoOHi8yasQNamIRlenRiVnhirHBiqHBjm3CMsAVqjOdgNmLbcGXtcQ64tMyOXhwbqdPhgHBABM2SrQOOh2CMsQTZfThlwQVLN5zTocK0CgcoNidxx6WnqchiSXjCqgNHdadjZnxiLXBjTXCNA0d1p40DR3WnjQNHdafPlQYbToy3YcNmHnLCBDeb5XO0CHvL6eWQRSQXaepw",
] as const;

export type RefLevelIndex = 0 | 1 | 2 | 3 | 4;

export const REF_LEVEL_COUNT = REF_LEVELS.length;

export type Point2 = Readonly<{ x: number; y: number }>;

export type Polygon = Readonly<{
	vertices: readonly Point2[];
	floorHeight: number;
	ceilingHeight: number;
}>;

export type RefObjectSpec = Readonly<{
	classIdx: number;
	position: Readonly<{ x: number; y: number; z: number }>;
	theta: number;
}>;

export type DecodedLevel = Readonly<{
	polygons: readonly Polygon[];
	objects: readonly RefObjectSpec[];
}>;

function decodeBase64ToBytes(encoded: string): Uint8Array {
	const bin = atob(encoded);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

export function decodeLevel(encoded: string): DecodedLevel {
	const commands = decodeBase64ToBytes(encoded);
	const polygons: Polygon[] = [];
	const objects: RefObjectSpec[] = [];
	const turtle: Point2[] = [{ x: 0, y: 0 }];
	let floorHeight = 4;
	let ceilingHeight = 40;

	let i = 0;
	while (i < commands.length) {
		const cmd = commands[i];
		i += 1;
		const low = cmd & 31;
		const high = cmd >> 5;

		if (high <= 1) {
			// Make a region with `low` vertices. high==0 = keep, high==1 = goto only.
			const verts: Point2[] = [turtle[0]];
			for (let v = 0; v < low && i < commands.length; v += 1) {
				const edge = commands[i];
				i += 1;
				const dx = ((edge >> 4) - 7) * 8;
				const dy = ((edge & 15) - 7) * 8;
				const next = { x: turtle[0].x + dx, y: turtle[0].y + dy };
				turtle.unshift(next);
				verts.push(next);
			}
			if (high === 0) {
				polygons.push({
					vertices: verts,
					floorHeight,
					ceilingHeight,
				});
			}
		} else if (high === 3) {
			// Object placement
			if (i + 1 >= commands.length) break;
			const a = commands[i];
			i += 1;
			const b = commands[i];
			i += 1;
			const dx = ((a >> 4) - 7) * 8;
			const dy = ((a & 15) - 7) * 8;
			const dz = ((b >> 4) - 7) * 2;
			const rot = b & 15;
			objects.push({
				classIdx: low,
				position: {
					x: turtle[0].x + dx,
					y: turtle[0].y + dy,
					z: floorHeight + dz,
				},
				theta: (rot / 8) * Math.PI,
			});
		} else if (high === 4) {
			floorHeight += 2 * (low - 15);
		} else if (high === 5) {
			ceilingHeight += 4 * (low - 15);
		} else if (high === 6) {
			turtle.splice(0, low);
		}
	}

	return { polygons, objects };
}

export function decodeRefLevel(index: RefLevelIndex): DecodedLevel {
	return decodeLevel(REF_LEVELS[index]);
}

export function listRefLevels(): readonly string[] {
	return REF_LEVELS;
}

export function levelBounds(level: DecodedLevel): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
} {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const poly of level.polygons) {
		for (const v of poly.vertices) {
			if (v.x < minX) minX = v.x;
			if (v.y < minY) minY = v.y;
			if (v.x > maxX) maxX = v.x;
			if (v.y > maxY) maxY = v.y;
		}
	}
	if (!Number.isFinite(minX)) {
		minX = minY = 0;
		maxX = maxY = 0;
	}
	return { minX, minY, maxX, maxY };
}
