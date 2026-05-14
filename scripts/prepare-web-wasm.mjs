/**
 * Copy WASM artifacts from node_modules into public/assets/wasm/ at
 * install + prebuild time, so the bundler never has to touch them.
 * Static `<base>/assets/wasm/<file>.wasm` URLs are then fetched at
 * runtime by whichever module needs them.
 *
 * Why not let vite handle it: vite's `import` transform inlines
 * `.wasm` as base64 by default, which OOMs the build worker pool for
 * anything over a few hundred KB. Copying to public/ keeps the WASM
 * as a separate static asset — the same pattern every other
 * three.js / r3f / sql.js reference project ships.
 *
 * Add an entry to ARTIFACTS below when a new WASM-shipping dep gets
 * added. The artifact gets copied at `pnpm install` (postinstall) and
 * at `pnpm run build` (prebuild) via the package.json hooks.
 */

import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/**
 * Each entry: { source: relative-to-root path under node_modules,
 *               destination: relative-to-root path under public,
 *               optional: bool, label: string }
 *
 * `optional: true` skips silently if the source isn't installed
 * (e.g. dep adopted later, or only used in a subset of builds).
 */
const ARTIFACTS = [
	{
		label: "sql.js",
		source: "node_modules/sql.js/dist/sql-wasm.wasm",
		destination: "public/assets/wasm/sql-wasm.wasm",
		optional: true,
	},
];

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

let copied = 0;
let skipped = 0;
for (const artifact of ARTIFACTS) {
	const src = resolve(root, artifact.source);
	const dst = resolve(root, artifact.destination);

	if (!(await exists(src))) {
		if (artifact.optional) {
			skipped += 1;
			continue;
		}
		throw new Error(
			`prepare-web-wasm: required artifact missing: ${artifact.source} (label=${artifact.label})`,
		);
	}

	await mkdir(dirname(dst), { recursive: true });
	await copyFile(src, dst);
	copied += 1;
}

console.log(`prepare-web-wasm: ${copied} artifact(s) copied, ${skipped} optional skipped.`);
