import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs script has no ambient types; the test reaches into the runtime exports directly.
import { CATEGORY_PATTERNS, inferCategory, slugify } from "../../../scripts/fetch-itch.mjs";

type CategoryEntry = readonly [RegExp, string];
type InferFn = (title: unknown) => string;
type SlugFn = (input: string) => string;

const patterns = CATEGORY_PATTERNS as ReadonlyArray<CategoryEntry>;
const infer = inferCategory as InferFn;
const slug = slugify as SlugFn;

/**
 * IF1 contract pins. The fetcher's category inference + slugify is the
 * only pure surface; everything else (curl, .env, fs.mkdir) is the
 * network/IO path. We pin the inference table here so adding a pattern
 * never silently steals coverage from an earlier one.
 */
describe("itch.io pack-category inference (IF1)", () => {
	it("returns 'misc' for empty, non-string, or unmatched titles", () => {
		expect(infer("")).toBe("misc");
		expect(infer("My personal totally-generic title")).toBe("misc");
		expect(infer(undefined)).toBe("misc");
		expect(infer(null)).toBe("misc");
		expect(infer(42)).toBe("misc");
	});

	it.each([
		["PSX Mega Pack II", "psx"],
		["Retro PSX Style Mansion Assets", "psx"],
		["PSX-Traps", "psx"], // hit on 'psx' before 'trap' (props)
		["PSX Horror-Fantasy Megapack", "psx"],
		["Horror Sounds Collection", "horror"],
		["Haunted House Pack", "horror"],
		["Sewer Fiend Creature Pack", "horror"],
		["Dark Ambient Game Music Pack", "audio"],
		["UI Sound Effects Pack", "audio"],
		["Retro PSX Footstep SFX Pack", "psx"], // psx wins over audio
		["Slasher Weapon Pack Release", "weapons"],
		["Stylized Guns 3D Models PRO", "weapons"],
		["Chibi Character Set", "characters"],
		// D4 — title kept as upstream "Skeleton Knight" (the itch.io pack
		// name); the inferCategory matcher in scripts/fetch-itch.mjs
		// keys off external pack titles, not our internal EnemyKind
		// (which is now "rattler").
		["Skeleton Knight", "characters"],
		["Tileset: Forest Edge", "2d"],
		["PSX-RV-Camper-Vans", "psx"], // psx wins over vehicles
		["Sci-Fi Tank Models", "vehicles"],
		["Ocean Surface Pack", "nature"],
		["Forest Trees Pack", "nature"],
		["Kitchen Items Pack", "food"],
		["PSX-Meats&Flesh", "psx"], // psx wins
		["Meat & Flesh Asset Pack", "food"],
		["Modular Mansion Asset Pack", "structures"],
		["Industrial Machinery Set", "props"],
		["Fantasy Treasure Loot", "fantasy"],
		["Magic Spells VFX", "fantasy"],
	])("infers '%s' → %s", (title, expected) => {
		expect(infer(title)).toBe(expected);
	});

	it("CATEGORY_PATTERNS is a non-empty ordered list of [RegExp, string]", () => {
		expect(Array.isArray(patterns)).toBe(true);
		expect(patterns.length).toBeGreaterThan(0);
		for (const entry of patterns) {
			expect(Array.isArray(entry)).toBe(true);
			expect(entry).toHaveLength(2);
			expect(entry[0]).toBeInstanceOf(RegExp);
			expect(typeof entry[1]).toBe("string");
		}
	});

	it("first-match-wins ordering: PSX always wins over audio/weapons/vehicles", () => {
		// These titles hit MULTIPLE patterns. The contract is that the
		// 'psx' pattern (which sits first in CATEGORY_PATTERNS) claims
		// them — otherwise a PSX-Weapons-Pack would end up filed under
		// weapons/, splitting the PSX library across categories.
		expect(infer("PSX Weapons Pack")).toBe("psx");
		expect(infer("PSX Audio SFX")).toBe("psx");
		expect(infer("PSX Vehicles Mega Pack")).toBe("psx");
		expect(infer("PS1 Horror Mansion")).toBe("psx");
	});
});

describe("itch.io slugify (IF1)", () => {
	it("lowercases + replaces non-alphanumeric with single hyphen", () => {
		expect(slug("PSX-Mega Pack II v1.8")).toBe("psx-mega-pack-ii-v1-8");
		expect(slug("Slasher Weapon Pack Release 10")).toBe("slasher-weapon-pack-release-10");
		expect(slug("Already-clean-slug")).toBe("already-clean-slug");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slug("---hello---")).toBe("hello");
		expect(slug("!@#start middle end!@#")).toBe("start-middle-end");
	});

	it("collapses runs of non-alphanumerics to a single hyphen", () => {
		expect(slug("a  b   c")).toBe("a-b-c");
		expect(slug("a___b---c***d")).toBe("a-b-c-d");
	});

	it("returns an empty string for empty input or input of only separators", () => {
		expect(slug("")).toBe("");
		expect(slug("...")).toBe("");
		expect(slug("___")).toBe("");
	});
});
