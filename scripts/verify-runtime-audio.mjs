#!/usr/bin/env node
/**
 * A11f — runtime audio verifier. Walks the SLOT_FILES manifest in
 * `src/audio/howlerBus.ts` and confirms every referenced audio file
 * actually exists under `public/assets/audio/` with non-zero size.
 *
 * Run by `pnpm verify` (gate); a missing or empty file blocks the
 * commit. Mirrors `scripts/verify-runtime-assets.mjs` (the model
 * verifier) but scoped to audio. Both run in the same `pnpm verify`
 * pass.
 *
 * Why parse the TS source instead of dynamic-importing it: the
 * howlerBus module pulls in Howler which expects a browser
 * AudioContext on load — incompatible with Node. Parsing the
 * literal SLOT_FILES table from source is fast and side-effect-free.
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOWLER_BUS = join(REPO_ROOT, "src", "audio", "howlerBus.ts");
const AUDIO_ROOT = join(REPO_ROOT, "public", "assets", "audio");

/**
 * Extract every literal string from the SLOT_FILES table by parsing
 * the source. The shape is `"path/to.ogg"` either directly as an
 * array literal or as the result of `.map((p) => \`weapon/${p}\`)`.
 * We compose both forms by collecting the raw quoted strings then
 * resolving the .map() prefix.
 */
async function collectAudioPaths() {
	const src = await readFile(HOWLER_BUS, "utf8");
	const paths = new Set();

	// Match the SLOT_FILES block (from `const SLOT_FILES` until the
	// matching closing brace). We use a non-greedy match against the
	// first `};` after the declaration.
	const block = src.match(/const SLOT_FILES[\s\S]*?\n\};/);
	if (!block) {
		console.error("ERROR: could not find SLOT_FILES block in howlerBus.ts");
		process.exit(2);
	}
	const text = block[0];

	// Two literal forms appear in the table:
	//   1. Plain array of quoted strings:  "weapon/foo.ogg"
	//   2. Templated .map(): `weapon/${p}` against ["bar.ogg", …]
	//      → we resolve by interpolating each predecessor.
	//   3. Templated .map(): `player/footstep/concrete-${i}.ogg`
	//      against [0, 1, 2, 3] → resolve by enumerating.

	// Strip Form-2 + Form-3 .map() blocks first so their inner
	// string literals don't double-count in the Form-1 sweep.
	// Form 2 — `.map((p) => \`<prefix>/${p}\`)`:
	let plain = text;
	for (const wrap of text.matchAll(
		/\[([^\]]*)\]\.map\(\s*\(p\)\s*=>\s*`([^`]*?)\$\{p\}`\s*,?\s*\)/g,
	)) {
		const arrText = wrap[1];
		const tmpl = wrap[2];
		for (const lit of arrText.matchAll(/"([^"]+)"/g)) {
			paths.add(`${tmpl}${lit[1]}`);
		}
		plain = plain.split(wrap[0]).join("");
	}

	// Form 3 — `[0, 1, 2, 3].map((i) => \`<prefix>-${i}.<ext>\`)`:
	for (const wrap of text.matchAll(
		/\[([^\]]*)\]\.map\(\s*\(i\)\s*=>\s*`([^`]*?)\$\{i\}([^`]*?)`\s*,?\s*\)/g,
	)) {
		const arrText = wrap[1];
		const pre = wrap[2];
		const post = wrap[3];
		for (const lit of arrText.matchAll(/\b(\d+)\b/g)) {
			paths.add(`${pre}${lit[1]}${post}`);
		}
		plain = plain.split(wrap[0]).join("");
	}

	// Form 1 — every quoted "..." that looks like an audio path,
	// AFTER stripping the Form-2/3 captures.
	for (const m of plain.matchAll(/"((?:[a-zA-Z\d_/-]+)\.(?:ogg|wav))"/g)) {
		paths.add(m[1]);
	}

	return [...paths].sort();
}

async function main() {
	const paths = await collectAudioPaths();
	if (paths.length === 0) {
		console.error("ERROR: no audio paths extracted from howlerBus.ts");
		process.exit(2);
	}
	const missing = [];
	const empty = [];
	let totalBytes = 0;
	for (const rel of paths) {
		const abs = join(AUDIO_ROOT, rel);
		try {
			const st = await stat(abs);
			if (!st.isFile()) {
				missing.push(rel);
			} else if (st.size === 0) {
				empty.push(rel);
			} else {
				totalBytes += st.size;
			}
		} catch (err) {
			if (err.code === "ENOENT") {
				missing.push(rel);
			} else {
				throw err;
			}
		}
	}
	const mb = (totalBytes / 1024 / 1024).toFixed(2);
	console.log(`verify-runtime-audio: ${paths.length} path(s) checked, ${mb} MB total`);
	if (missing.length > 0) {
		console.error(`\nMISSING ${missing.length} file(s):`);
		for (const m of missing) console.error(`  - ${m}`);
	}
	if (empty.length > 0) {
		console.error(`\nEMPTY ${empty.length} file(s) (0 bytes — likely a broken ffmpeg run):`);
		for (const e of empty) console.error(`  - ${e}`);
	}
	if (missing.length > 0 || empty.length > 0) {
		console.error("\nFix: re-run `pnpm audio:promote:apply` to repopulate from raw-assets/.");
		process.exit(1);
	}
	console.log("verify-runtime-audio: OK");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
