#!/usr/bin/env node
/**
 * General-purpose itch.io library fetcher. Downloads owned packs into
 * raw-assets/archives/ and extracts into raw-assets/extracted/<category>/.
 * Idempotent (skips downloads where the archive already exists with
 * matching md5). Both directories are gitignored.
 *
 * Reads ITCH_API_KEY from .env. The owned-key cache lives at
 * .itch-cache/all-keys.json (built by IF2). Allow-list lives at
 * scripts/itch-allowlist.json (built by IF4).
 *
 * Usage:
 *   node scripts/fetch-itch.mjs --dry                  # list what would be downloaded
 *   node scripts/fetch-itch.mjs                        # download + extract everything on the allow-list
 *   node scripts/fetch-itch.mjs --filter=psx,horror    # comma-separated category filter
 *   node scripts/fetch-itch.mjs --inventory            # write docs/ITCH-INVENTORY.md (IF3)
 *
 * Per PRD §IF1. Adapted from
 * ~/src/arcade-cabinet/voxel-realms/scripts/fetch-itch-audio.mjs;
 * the original was audio-only.
 *
 * `inferCategory` and `CATEGORY_PATTERNS` are exported so the unit
 * suite (src/__tests__/unit/objexoom-itchCategory.test.ts) can pin
 * the inference contract without spawning the network path.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
// 7zip-min ships a static 7za across platforms — covers zip / 7z / tar /
// gzip / bzip2 without needing system unzip or 7z installed.
import _7z from "7zip-min";
// node-unrar-js handles .rar (7za doesn't). Pure-JS, no native binary.
import { createExtractorFromFile } from "node-unrar-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ARCHIVES = join(ROOT, "raw-assets", "archives");
const EXTRACTED = join(ROOT, "raw-assets", "extracted");
const CACHE = join(ROOT, ".itch-cache");
const KEYS_PATH = join(CACHE, "all-keys.json");
const ALLOWLIST_PATH = join(ROOT, "scripts", "itch-allowlist.json");
const INVENTORY_PATH = join(ROOT, "docs", "ITCH-INVENTORY.md");

// Category inference from pack title. Patterns are ordered: first match wins.
// Add new patterns as the library audit surfaces new buckets.
export const CATEGORY_PATTERNS = [
	[/\b(psx|ps1|low.?poly retro|retro 3d)/i, "psx"],
	[/\b(horror|haunt|creep|crypt|gore|undead|zombie|ghost|monster|nun|sewer|fiend)/i, "horror"],
	[/\b(sfx|sound|music|audio|loop|ambient|footstep)/i, "audio"],
	[/\b(character|creature|enemy|npc|skeleton|wraith)/i, "characters"],
	[/\b(weapon|gun|knife|axe|sword|blade|firearm|melee)/i, "weapons"],
	[/\b(tileset|tilemap|2d|pixel|sprite)/i, "2d"],
	[/\b(vehicle|car|truck|rv|camper|van|tank)/i, "vehicles"],
	[/\b(nature|tree|plant|forest|flower|leaf|grass|ocean|water)/i, "nature"],
	[/\b(food|kitchen|meat|farm|fruit|veggie)/i, "food"],
	[/\b(building|structure|architecture|mansion|castle|dungeon|crypt)/i, "structures"],
	[/\b(prop|misc|asset pack|mega pack|machinery|trap|electrical|industrial)/i, "props"],
	[/\b(fantasy|magic|spell|gem|loot|treasure)/i, "fantasy"],
];

export function inferCategory(title) {
	if (typeof title !== "string" || title.length === 0) return "misc";
	for (const [pat, cat] of CATEGORY_PATTERNS) if (pat.test(title)) return cat;
	return "misc";
}

export function slugify(s) {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function loadKey() {
	const envPath = join(ROOT, ".env");
	if (!existsSync(envPath)) {
		console.error("scripts/fetch-itch: .env missing from repo root.");
		console.error("  Add `ITCH_API_KEY=<your-key>` (gitignored).");
		console.error("  Generate at https://itch.io/user/settings/api-keys");
		process.exit(1);
	}
	const envText = readFileSync(envPath, "utf8");
	const key = envText.match(/^ITCH_API_KEY=(\S+)/m)?.[1];
	if (!key) {
		console.error("scripts/fetch-itch: ITCH_API_KEY missing from .env");
		process.exit(1);
	}
	return key;
}

async function extractRar(archivePath, destDir) {
	const extractor = await createExtractorFromFile({
		filepath: archivePath,
		targetPath: destDir,
	});
	// extractAll returns an iterator; consuming it triggers extraction.
	const { files } = extractor.extract();
	for (const _ of files) {
		// no-op — iterating triggers extraction side effects
	}
}

function apiGet(key, path) {
	const result = spawnSync(
		"curl",
		["-sS", "-fL", "-H", `Authorization: Bearer ${key}`, `https://itch.io${path}`],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		console.error(`  apiGet failed: ${path} (exit=${result.status})`);
		return null;
	}
	try {
		return JSON.parse(result.stdout);
	} catch {
		console.error(`  apiGet: non-JSON response for ${path}`);
		return null;
	}
}

// Some packs ship with malformed URLs (the author typed the URL into the
// URL field itself, producing e.g. `https://author.itch.io/httpsauthoritchio`).
// Strip those so the inventory doc doesn't carry dead links.
function sanitizeUrl(url) {
	if (typeof url !== "string" || url.length === 0) return "";
	if (/itch\.io\/https?[a-z0-9-]*itchio/i.test(url)) return "";
	if (/^https?:\/\/(www\.)?[a-z0-9.-]+\/$/i.test(url)) return url;
	if (/^https?:\/\//i.test(url)) return url;
	return "";
}

function writeInventory(packsList) {
	// Deduplicate owned keys: the same game can ship multiple
	// download_keys per account (free + paid bundles, replacement keys).
	// Group inventory rows by `game.id` so the doc shows one entry per
	// unique pack, and per-category counts aren't inflated.
	const dedup = new Map();
	for (const p of packsList) {
		const gameId = p?.game?.id;
		if (gameId == null) continue;
		if (!dedup.has(gameId)) dedup.set(gameId, p);
	}
	const unique = [...dedup.values()];

	const byCategory = new Map();
	for (const p of unique) {
		const cat = p.category ?? "misc";
		if (!byCategory.has(cat)) byCategory.set(cat, []);
		byCategory.get(cat).push(p);
	}
	const cats = [...byCategory.keys()].sort();
	const lines = [
		"---",
		"title: itch.io owned-pack inventory",
		`updated: ${new Date().toISOString().slice(0, 10)}`,
		"status: current",
		"domain: ops",
		"---",
		"",
		"# itch.io owned-pack inventory",
		"",
		`Generated by \`pnpm itch:fetch --inventory\` from \`.itch-cache/all-keys.json\`. ${unique.length} unique owned packs across ${cats.length} categories (deduplicated from ${packsList.length} download-keys).`,
		"",
		"Categories are inferred from the pack title via the pattern table in `scripts/fetch-itch.mjs`. Edit the patterns when the audit surfaces new buckets.",
		"",
	];
	for (const cat of cats) {
		const group = byCategory
			.get(cat)
			.sort((a, b) => (a?.game?.title ?? "").localeCompare(b?.game?.title ?? ""));
		lines.push(`## ${cat} — ${group.length} pack${group.length === 1 ? "" : "s"}`, "");
		for (const p of group) {
			const title = p?.game?.title ?? "(untitled)";
			const url = sanitizeUrl(p?.game?.url);
			lines.push(url ? `- [${title}](${url})` : `- ${title}`);
		}
		lines.push("");
	}
	writeFileSync(INVENTORY_PATH, lines.join("\n"));
	console.log(`Wrote ${INVENTORY_PATH} (${packsList.length} packs, ${cats.length} categories)`);
}

function refreshKeys(key) {
	// Walks /api/1/key/keys?page=N (50 items/page) until the API returns
	// an empty page, accumulates every owned download_key, writes the
	// merged result to .itch-cache/all-keys.json. Per PRD §IF2.
	mkdirSync(CACHE, { recursive: true });
	const out = [];
	let page = 1;
	while (true) {
		const resp = apiGet(key, `/api/1/my-owned-keys?page=${page}`);
		const keys = resp?.owned_keys ?? [];
		if (keys.length === 0) break;
		out.push(...keys);
		console.log(`  page ${page}: +${keys.length} keys (total ${out.length})`);
		page++;
		if (page > 100) {
			console.error("  refreshKeys: page-cap hit at 100, bailing");
			break;
		}
	}
	writeFileSync(KEYS_PATH, JSON.stringify(out, null, 2));
	console.log(`refreshKeys: wrote ${out.length} owned keys to ${KEYS_PATH}`);
	return out;
}

async function main() {
	const argv = process.argv.slice(2);
	const DRY = argv.includes("--dry");
	const INVENTORY = argv.includes("--inventory");
	const REFRESH_KEYS = argv.includes("--refresh-keys");
	const filterArg = argv.find((a) => a.startsWith("--filter="));
	const categoryFilter = filterArg
		? new Set(
				filterArg
					.slice("--filter=".length)
					.split(",")
					.map((s) => s.trim().toLowerCase()),
			)
		: null;

	// `--inventory` reads `.itch-cache/all-keys.json` only — no network,
	// no API key needed. Defer `loadKey()` so a missing `.env` doesn't
	// block inventory generation. Network paths (`--refresh-keys` + the
	// download flow) still load the key below where they need it.
	const needsKey = REFRESH_KEYS || (!INVENTORY && !DRY);
	const KEY = needsKey ? loadKey() : "";

	if (REFRESH_KEYS) {
		refreshKeys(KEY);
		if (!INVENTORY) return;
	}

	if (!existsSync(KEYS_PATH)) {
		console.error(
			`scripts/fetch-itch: ${KEYS_PATH} missing. Run IF2 to populate the owned-keys cache.`,
		);
		console.error("  Suggested IF2 command: node scripts/fetch-itch.mjs --refresh-keys");
		process.exit(1);
	}

	const allPacks = JSON.parse(readFileSync(KEYS_PATH, "utf8"));

	for (const p of allPacks) {
		if (!p.category) p.category = inferCategory(p?.game?.title ?? "");
	}

	if (INVENTORY) {
		writeInventory(allPacks);
		return;
	}

	const allowlist = existsSync(ALLOWLIST_PATH)
		? JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"))
		: { titles: [] };
	const allowSet = new Set(allowlist.titles ?? []);

	const packs = allPacks.filter((p) => {
		if (!allowSet.has(p?.game?.title)) return false;
		if (categoryFilter && !categoryFilter.has(p.category)) return false;
		return true;
	});

	const declined = allPacks.length - packs.length;
	const filterDesc = categoryFilter ? ` filter=${[...categoryFilter].join(",")}` : "";
	console.log(
		`fetch-itch: ${packs.length}/${allPacks.length} packs queued ` +
			`(${declined} declined${filterDesc}, dry=${DRY})`,
	);

	if (packs.length === 0) {
		console.log("Nothing to download. Edit scripts/itch-allowlist.json to enable packs.");
		return;
	}

	mkdirSync(ARCHIVES, { recursive: true });
	mkdirSync(EXTRACTED, { recursive: true });

	let downloaded = 0;
	let skipped = 0;
	let failed = 0;
	const downloadedArchives = [];

	for (const pack of packs) {
		const dkid = pack.id;
		const gameId = pack?.game?.id;
		const title = pack?.game?.title;
		const category = pack.category;
		if (!gameId || !title) {
			console.error(`  skipping pack with malformed game payload (dkid=${dkid})`);
			failed++;
			continue;
		}

		const uploadsResp = apiGet(KEY, `/api/1/key/game/${gameId}/uploads?download_key_id=${dkid}`);
		const uploads = (uploadsResp?.uploads ?? []).filter((u) =>
			/\.(zip|7z|rar|tar\.gz|tgz)$/i.test(u.filename ?? ""),
		);

		if (uploads.length === 0) {
			console.warn(`  [${category}/${title}] no archive uploads found`);
			failed++;
			continue;
		}

		// Namespace the archive on disk by `<category>/<dkid>-<filename>`
		// so two packs that ship a `Pack.zip` upload can't overwrite
		// each other. Pre-existing flat-namespace archives are detected
		// by md5 fall-through (`skipped` path).
		const packArchiveDir = join(ARCHIVES, category);
		mkdirSync(packArchiveDir, { recursive: true });

		for (const upload of uploads) {
			const filename = upload.filename;
			const namespaced = `${dkid}-${filename}`;
			const dest = join(packArchiveDir, namespaced);

			if (existsSync(dest)) {
				const localBytes = statSync(dest).size;
				if (localBytes === upload.size) {
					const hash = createHash("md5");
					hash.update(readFileSync(dest));
					if (hash.digest("hex") === upload.md5_hash) {
						skipped++;
						downloadedArchives.push({ path: dest, file: namespaced, category });
						continue;
					}
				}
			}

			if (DRY) {
				console.log(
					`  WOULD DOWNLOAD: ${category}/${namespaced} (${upload.size} bytes) ← ${title}`,
				);
				downloaded++;
				continue;
			}

			const dlInfo = apiGet(KEY, `/api/1/key/upload/${upload.id}/download?download_key_id=${dkid}`);
			const signedUrl = dlInfo?.url;
			if (!signedUrl) {
				console.error(`  [${category}/${title}] no signed URL in response`);
				failed++;
				continue;
			}

			const result = spawnSync("curl", ["-sS", "-fL", "-o", dest, signedUrl], { stdio: "inherit" });
			if (result.status !== 0) {
				console.error(`  [${category}/${title}] curl failed for ${filename}`);
				failed++;
				continue;
			}
			const localBytes = statSync(dest).size;
			if (localBytes !== upload.size) {
				console.error(
					`  [${category}/${title}] size mismatch: got ${localBytes}, expected ${upload.size}`,
				);
				failed++;
				continue;
			}
			console.log(`  ✓ ${category}/${namespaced} (${upload.size} bytes) ← ${title}`);
			downloaded++;
			downloadedArchives.push({ path: dest, file: namespaced, category });
		}
	}

	if (!DRY) {
		console.log("\nExtracting…");
		// Iterate ONLY archives downloaded/skipped in this run; ignore
		// historical archives sitting on disk from earlier runs or
		// out-of-band drops. This honors the allowlist+filter scope and
		// keeps extraction strictly tied to the run's downloads.
		for (const { path: archivePath, file, category } of downloadedArchives) {
			if (!/\.(zip|7z|rar|tar\.gz|tgz)$/i.test(file)) continue;
			const slug = slugify(file.replace(/\.(zip|7z|rar|tar\.gz|tgz)$/i, ""));
			const target = join(EXTRACTED, category, slug);
			if (existsSync(target)) continue;
			mkdirSync(target, { recursive: true });
			try {
				if (file.toLowerCase().endsWith(".rar")) {
					await extractRar(archivePath, target);
				} else {
					// 7zip-min handles zip / 7z / tar / tar.gz / tgz natively.
					await _7z.unpack(archivePath, target);
				}
				console.log(`  ✓ extracted ${category}/${slug}`);
			} catch (err) {
				console.error(`  ✗ failed to extract ${file}: ${err instanceof Error ? err.message : err}`);
			}
		}
	}

	console.log(`\nDone. downloaded=${downloaded} skipped=${skipped} failed=${failed}`);
}

// Only invoke main() when executed directly. Importing this module
// (e.g. from the unit test) does not trigger the .env / network path.
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
