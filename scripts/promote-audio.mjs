#!/usr/bin/env node
/**
 * A11b — promote selected itch.io audio assets into
 * `public/assets/audio/` per the docs/AUDIO-INVENTORY.md slot table.
 *
 * Workflow:
 *   1. For each slot mapping below, glob the source pack subfolder
 *      with the regex selector.
 *   2. Sort matches lexically + take the first N (variant pool size).
 *   3. Copy to public/assets/audio/<slug>-{0..N-1}.ogg.
 *   4. (Optional, --normalize) run ffmpeg `loudnorm` filter to
 *      target -16 LUFS so the music bed doesn't drown out weapons.
 *
 * The script is idempotent — re-running overwrites existing slot
 * files but never appends. Run after `pnpm itch:fetch` extracts new
 * packs.
 *
 * Usage:
 *   node scripts/promote-audio.mjs            # dry-run report
 *   node scripts/promote-audio.mjs --apply    # actually copy
 *   node scripts/promote-audio.mjs --apply --normalize
 */

import { execFile as execFileCb } from "node:child_process";
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = join(REPO_ROOT, "raw-assets", "extracted", "audio");
const HORROR_ROOT = join(REPO_ROOT, "raw-assets", "extracted", "horror");
const DEST_ROOT = join(REPO_ROOT, "public", "assets", "audio");

const APPLY = process.argv.includes("--apply");
const NORMALIZE = process.argv.includes("--normalize");

// Slot table — each entry: { slug, source pack root, regex selector,
// variant count }. Slug is the public/assets/audio/<slug>{-N}.ogg
// path. Variant count > 1 promotes <slug>-0.ogg, <slug>-1.ogg, …
// Single-variant slots emit <slug>.ogg (no suffix).
const SLOTS = [
	// Weapons
	{
		slug: "weapon/pistol/fire",
		root: "weapon-laser-sound-effects-pack",
		re: /(plasma|laser)_shot/i,
		variants: 3,
	},
	{
		slug: "weapon/chaingun/loop-body",
		root: "weapon-laser-sound-effects-pack",
		re: /sci_fi_weapon/i,
		variants: 2,
	},
	{
		slug: "weapon/shotgun/fire",
		root: "game-explosion-sound-effects-pack",
		re: /explosion_boom/i,
		variants: 3,
	},
	{
		slug: "weapon/flamethrower/loop-body",
		root: "game-explosion-sound-effects-pack",
		re: /explosion_fire/i,
		variants: 2,
	},
	{
		slug: "weapon/weapon-empty",
		root: "weapon-laser-sound-effects-pack",
		re: /weapon_empty/i,
		variants: 1,
	},
	{
		slug: "weapon/swap",
		root: "inventory-and-item-sound-effects-pack",
		re: /button_soft/i,
		variants: 1,
	},

	// Player feet — surface tags. The pack mostly ships generic
	// `pl_footstep_*_NN.ogg`; specialize via subterm matching.
	{
		slug: "player/footstep/concrete",
		root: "footsteps-sound-effects-pack",
		re: /footstep_stone/i,
		variants: 4,
	},
	{
		slug: "player/footstep/wood",
		root: "footsteps-sound-effects-pack",
		re: /footstep_wood/i,
		variants: 4,
	},
	{
		slug: "player/footstep/gravel",
		root: "footsteps-sound-effects-pack",
		re: /footstep_dirt|footstep_grass/i,
		variants: 4,
	},
	{
		slug: "player/footstep/water",
		root: "footsteps-sound-effects-pack",
		re: /footstep_water/i,
		variants: 4,
	},
	{
		slug: "player/footstep/metal",
		root: "footsteps-sound-effects-pack",
		re: /footstep_metal/i,
		variants: 4,
	},
	{ slug: "player/jump", root: "footsteps-sound-effects-pack", re: /pl_jump/i, variants: 2 },
	{ slug: "player/land", root: "footsteps-sound-effects-pack", re: /pl_land/i, variants: 2 },

	// Pickups — inventory pack uses `pl_<thing>_pickup_NN.ogg`
	{
		slug: "pickup/health",
		root: "inventory-and-item-sound-effects-pack",
		re: /potion_pickup/i,
		variants: 1,
	},
	{
		slug: "pickup/ammo",
		root: "inventory-and-item-sound-effects-pack",
		re: /coin_pickup/i,
		variants: 1,
	},
	{
		slug: "pickup/key",
		root: "inventory-and-item-sound-effects-pack",
		re: /key_pickup|key_get/i,
		variants: 1,
	},
	{
		slug: "pickup/flashlight",
		root: "inventory-and-item-sound-effects-pack",
		re: /pl_bag_open/i,
		variants: 1,
	},
	{
		slug: "pickup/treasure",
		root: "inventory-and-item-sound-effects-pack",
		re: /gold_pickup|chest_loot/i,
		variants: 1,
	},
	{
		slug: "pickup/secret",
		root: "fantasy-magic-spell-sound-effects-pack",
		re: /magic_buff/i,
		variants: 1,
	},

	// Impacts
	{ slug: "enemy/hit", root: "impact-hit-sound-effects-pack", re: /hit|impact/i, variants: 4 },
	{
		slug: "enemy/death-generic",
		root: "impact-hit-sound-effects-pack",
		re: /impact_body|impact_heavy/i,
		variants: 3,
	},

	// UI — pixelloops UI pack is WAV-only; specialize via filename.
	{ slug: "ui/nav", root: "pixelloops-ui-sound-effects-pack", re: /pl_click/i, variants: 1 },
	{ slug: "ui/confirm", root: "pixelloops-ui-sound-effects-pack", re: /pl_confirm/i, variants: 1 },
	{ slug: "ui/back", root: "pixelloops-ui-sound-effects-pack", re: /pl_cancel/i, variants: 1 },
	{ slug: "ui/hover", root: "pixelloops-ui-sound-effects-pack", re: /pl_notif/i, variants: 1 },

	// Music — beds. Each pack ships several full tracks; take the
	// first one alphabetically as the bed; multi-bed swap is a
	// future refinement.
	{
		slug: "music/corridor/loop",
		root: "retro-dungeon-game-music-pack",
		re: /Dark_Corridor|Lost_Labyrinth/i,
		variants: 1,
	},
	{
		slug: "music/arena/loop",
		root: "pixelloops-retro-combat-pack",
		re: /Heroic_Clash|Battle/i,
		variants: 1,
	},
	{
		slug: "music/boss/loop",
		root: "pixelloops-retro-chiptune-boss-battle-pack",
		re: /boss|battle|final/i,
		variants: 1,
	},
	{
		slug: "music/library/loop",
		root: "toys-in-the-attic-a-music-box-music-pack",
		re: /attic|box|lullaby/i,
		variants: 1,
	},

	// Ambient — ultimate-game-ambient is huge; selectors target the
	// archetype mood.
	{
		slug: "ambient/corridor/bed",
		root: "ultimate-game-ambient-sound-effects-pack",
		re: /ambient_dungeon|ambient_factory/i,
		variants: 1,
	},
	{
		slug: "ambient/arena/bed",
		root: "ultimate-game-ambient-sound-effects-pack",
		re: /ambient_wind/i,
		variants: 1,
	},
	{
		slug: "ambient/sewer/bed",
		root: "ultimate-game-ambient-sound-effects-pack",
		re: /ambient_cave/i,
		variants: 1,
	},
	{
		slug: "ambient/library/bed",
		root: "ultimate-game-ambient-sound-effects-pack",
		re: /ambient_temple|ambient_ruins/i,
		variants: 1,
	},

	// System stingers
	{
		slug: "system/mission-complete",
		root: "victory-level-complete-music-pack-24-stingers-pixelloops",
		re: /victory_01|victory_02|victory_03/i,
		variants: 1,
	},
	{
		slug: "system/going-back-klaxon",
		root: "cinematic-whoosh-sfx-pack-40-fast-transition-sounds",
		re: /whoosh_hard|whoosh_dramatic/i,
		variants: 1,
	},
	{
		slug: "system/level-transition",
		root: "cinematic-whoosh-sfx-pack-40-fast-transition-sounds",
		re: /whoosh_cinematic|whoosh_fast/i,
		variants: 1,
	},
	{
		slug: "system/barrel-explosion",
		root: "game-explosion-sound-effects-pack",
		re: /explosion_debris|explosion_distant/i,
		variants: 2,
	},
	{
		slug: "system/boss-defeat",
		root: "game-explosion-sound-effects-pack",
		re: /explosion_big/i,
		variants: 1,
	},
	{
		slug: "system/chest-open",
		root: "inventory-and-item-sound-effects-pack",
		re: /chest_loot|unlock/i,
		variants: 1,
	},
];

async function walkAudio(root) {
	// Prefer OGG when both ship in a pack; fall back to WAV when only
	// WAV is provided (several pixelloops packs are WAV-only). MP3 is
	// patent-encumbered — explicitly skipped via the dir filter.
	const oggs = [];
	const wavs = [];
	async function recurse(dir) {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const e of entries) {
			const full = join(dir, e.name);
			if (e.isDirectory()) {
				if (/^(Preview|MP3|Documentation|License|Licenses)$/i.test(e.name)) continue;
				await recurse(full);
			} else if (e.isFile()) {
				const ext = extname(e.name).toLowerCase();
				if (ext === ".ogg") oggs.push(full);
				else if (ext === ".wav") wavs.push(full);
			}
		}
	}
	try {
		await recurse(root);
	} catch (err) {
		if (err.code !== "ENOENT") throw err;
	}
	return oggs.length > 0 ? oggs : wavs;
}

async function ensureDir(p) {
	await mkdir(dirname(p), { recursive: true });
}

async function maybeNormalize(src, dest) {
	const srcExt = extname(src).toLowerCase();
	const isMusicWav = srcExt === ".wav" && /\/music\//.test(dest);
	// Music tracks are 25-30MB uncompressed WAV from pixelloops packs.
	// Always re-encode music to Opus-in-OGG (1.5-2.5MB) — bundling
	// 30MB tracks would blow the gh-pages bandwidth budget. SFX stay
	// as-shipped (small enough to skip a transcode pass).
	if (isMusicWav) {
		const opusDest = dest.replace(/\.wav$/, ".ogg");
		await execFile("ffmpeg", ["-y", "-i", src, "-c:a", "libopus", "-b:a", "96k", opusDest]);
		return;
	}
	if (!NORMALIZE) {
		await copyFile(src, dest);
		return;
	}
	// loudnorm: target -16 LUFS, single-pass is good enough for SFX.
	// Re-encodes to Opus in OGG container (Howler decodes both).
	const normDest = dest.replace(/\.wav$/, ".ogg");
	await execFile("ffmpeg", [
		"-y",
		"-i",
		src,
		"-filter:a",
		"loudnorm=I=-16:TP=-1.5:LRA=11",
		"-c:a",
		"libopus",
		"-b:a",
		"128k",
		normDest,
	]);
}

async function main() {
	let totalPlanned = 0;
	let totalCopied = 0;
	const missing = [];
	for (const slot of SLOTS) {
		const packRoot = (await stat(join(SRC_ROOT, slot.root)).catch(() => null))
			? join(SRC_ROOT, slot.root)
			: join(HORROR_ROOT, slot.root);
		const files = await walkAudio(packRoot);
		const matches = files.filter((f) => slot.re.test(f)).sort();
		if (matches.length === 0) {
			missing.push(slot.slug);
			continue;
		}
		const take = matches.slice(0, slot.variants);
		for (let i = 0; i < take.length; i++) {
			const suffix = slot.variants > 1 ? `-${i}` : "";
			// Preserve source extension — if the vendor only ships WAV,
			// promote as WAV. Howler decodes both; OGG is preferred for
			// size but Bone Buster ships as a single bundle anyway.
			const ext = extname(take[i]).toLowerCase();
			const dest = join(DEST_ROOT, `${slot.slug}${suffix}${ext}`);
			totalPlanned += 1;
			if (APPLY) {
				await ensureDir(dest);
				await maybeNormalize(take[i], dest);
				totalCopied += 1;
			}
			if (process.env.VERBOSE) {
				console.log(`${slot.slug}${suffix} ← ${relative(REPO_ROOT, take[i])}`);
			}
		}
	}
	console.log(
		`\n${APPLY ? "Promoted" : "Plan: promote"} ${APPLY ? totalCopied : totalPlanned} slot files across ${SLOTS.length} slots.`,
	);
	if (missing.length > 0) {
		console.log(`\nMissing matches for ${missing.length} slot(s):`);
		for (const m of missing) console.log(`  - ${m}`);
		console.log(
			"\nFix: review the regex selector in scripts/promote-audio.mjs against the actual pack contents.",
		);
		process.exitCode = 1;
	}
	if (!APPLY) {
		console.log(
			"\nRe-run with --apply to actually copy. Add --normalize to LUFS-normalize via ffmpeg.",
		);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
