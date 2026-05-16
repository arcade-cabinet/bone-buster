/**
 * INF2 — post-build asset report.
 *
 * Vite's default build already copies `public/` to `dist/`, so this
 * script does NOT do the copy — it walks `dist/assets/` (or
 * equivalent) and emits a per-category total report so the build
 * output makes asset weight visible to the reader.
 *
 * No arbitrary byte budgets — asset weight is tuned deliberately
 * per pickup, not enforced by a CI threshold (per directive). The
 * report is informational so you SEE the cost of a new pack copy
 * landing in CI logs, not a gate that blocks it.
 */

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

// Honor `--dir=<path>` so the script can target a non-default build
// output (e.g. for `pnpm build:pages` which writes to a base-prefixed
// dist path).
const dirArg = process.argv.find((a) => a.startsWith("--dir="));
// Post-Vike: Vite outputs to `dist/client/` (Vike splits browser +
// SSR bundles), so the default report target moved from
// `dist/assets/` to `dist/client/assets/`. Pre-Vike build invocations
// can override with `--dir=...`.
const defaultDir = join(root, "dist", "client", "assets");
const target = dirArg ? resolve(root, dirArg.slice("--dir=".length)) : defaultDir;

function formatBytes(n) {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

async function walk(dir) {
	const out = [];
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch (err) {
		if (err.code === "ENOENT") return out;
		throw err;
	}
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			out.push(...(await walk(p)));
		} else if (e.isFile()) {
			const info = await stat(p);
			out.push({ path: p, size: info.size });
		}
	}
	return out;
}

const files = await walk(target);
if (files.length === 0) {
	console.warn(`copy-public-assets: ${target} not found or empty (skipping report)`);
	process.exit(0);
}

// Categorize by the first segment after `assets/`.
const categories = new Map();
for (const f of files) {
	const rel = f.path.slice(target.length + 1);
	const cat = rel.split("/")[0] || "(root)";
	const bucket = categories.get(cat) ?? { count: 0, bytes: 0 };
	bucket.count += 1;
	bucket.bytes += f.size;
	categories.set(cat, bucket);
}

const sortedCats = [...categories.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
const totalBytes = files.reduce((s, f) => s + f.size, 0);

console.log(`copy-public-assets: ${files.length} file(s) in ${target}`);
for (const [cat, { count, bytes }] of sortedCats) {
	console.log(`  ${cat}: ${count} file(s), ${formatBytes(bytes)}`);
}
console.log(`  TOTAL: ${formatBytes(totalBytes)}`);
