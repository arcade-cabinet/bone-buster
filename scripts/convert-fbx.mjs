#!/usr/bin/env node
/**
 * Batch-convert the curated FBX assets under `references/_extracted/` into
 * GLB form under `public/assets/models/`. Run on demand whenever the
 * curated source list below changes.
 *
 * Why this exists: a few of the most usable horror creatures (plague
 * doctor, elk demon, clown variants, rigged abomination) and the entire
 * Slasher weapon pack ship as FBX only. The rest of OBJEXOOM consumes
 * GLB via drei's `useGLTF`; rather than ship a runtime FBX loader we
 * convert at build/seed time.
 *
 * Usage:
 *   pnpm assets:fbx-to-glb            # or `node scripts/convert-fbx.mjs`
 *
 * Idempotent — skips outputs that are newer than their FBX source.
 *
 * Source-of-truth for which FBX maps to which GLB: see
 * `docs/ASSET_PROVENANCE.md` — every JOBS entry here MUST have a row
 * in that doc (provenance, license, conversion notes).
 */
import { mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import convert from "fbx2gltf";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

/** @type {{ fbx: string, glb: string, label: string }[]} */
const JOBS = [
	// Horror enemies (rigged FBX variants — keep alongside the
	// already-shipping GLB variants of the same packs).
	{
		fbx: "references/_extracted/horror_rigged/PSX Horror-Fantasy Megapack/abomination/final_rigged.fbx",
		glb: "public/assets/models/enemies/horror/abomination_rigged.glb",
		label: "abomination (rigged)",
	},
	{
		fbx: "references/_extracted/horror_rigged/PSX Horror-Fantasy Megapack/plague doctor/final_rigged.fbx",
		glb: "public/assets/models/enemies/horror/plague_doctor.glb",
		label: "plague doctor",
	},
	{
		fbx: "references/_extracted/horror_rigged/PSX Horror-Fantasy Megapack/elkdemon/final_rigged.fbx",
		glb: "public/assets/models/enemies/horror/elk_demon.glb",
		label: "elk demon",
	},
	{
		fbx: "references/_extracted/horror_rigged/PSX Horror-Fantasy Megapack/clowns pack/1/final_rigged.fbx",
		glb: "public/assets/models/enemies/horror/clown_1.glb",
		label: "clown 1",
	},
	{
		fbx: "references/_extracted/horror_rigged/PSX Horror-Fantasy Megapack/clowns pack/3/final_rigged.fbx",
		glb: "public/assets/models/enemies/horror/clown_3.glb",
		label: "clown 3",
	},
	// Slasher melee weapons — bonus melee viewmodel options.
	{
		fbx: "references/_extracted/slasher/Axe/Axe.fbx",
		glb: "public/assets/models/weapons/slasher/melee_axe.glb",
		label: "axe",
	},
	{
		fbx: "references/_extracted/slasher/Chainsaw/Chainsaw.fbx",
		glb: "public/assets/models/weapons/slasher/melee_chainsaw.glb",
		label: "chainsaw",
	},
	{
		fbx: "references/_extracted/slasher/Kitchen Knife/kitchenKnife.fbx",
		glb: "public/assets/models/weapons/slasher/melee_knife.glb",
		label: "kitchen knife",
	},
	{
		fbx: "references/_extracted/slasher/Machete/Machete.fbx",
		glb: "public/assets/models/weapons/slasher/melee_machete.glb",
		label: "machete",
	},
	{
		fbx: "references/_extracted/slasher/Meat Hook/MeatHook.fbx",
		glb: "public/assets/models/weapons/slasher/melee_meathook.glb",
		label: "meat hook",
	},
];

function mtimeOrZero(path) {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return 0;
	}
}

let converted = 0;
let skipped = 0;
let failed = 0;
for (const job of JOBS) {
	const fbxPath = resolve(ROOT, job.fbx);
	const glbPath = resolve(ROOT, job.glb);
	const fbxM = mtimeOrZero(fbxPath);
	if (fbxM === 0) {
		console.warn(`SKIP ${job.label}: source missing (${job.fbx})`);
		skipped += 1;
		continue;
	}
	const glbM = mtimeOrZero(glbPath);
	if (glbM > fbxM) {
		console.log(`SKIP ${job.label}: GLB already up to date`);
		skipped += 1;
		continue;
	}
	mkdirSync(dirname(glbPath), { recursive: true });
	process.stdout.write(`CONVERT ${job.label} ... `);
	try {
		// The npm wrapper expects the destination to end in `.glb` (binary
		// output) or `.gltf` (text output). We want binary embedded.
		await convert(fbxPath, glbPath, ["--khr-materials-unlit"]);
		console.log("OK");
		converted += 1;
	} catch (err) {
		console.error(`FAIL: ${err instanceof Error ? err.message : err}`);
		failed += 1;
	}
}

console.log(`\nDone. converted=${converted} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
