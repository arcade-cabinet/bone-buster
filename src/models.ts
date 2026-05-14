/**
 * OBJEXOOM 3D model registry.
 *
 * Procedural geometry handles the level structure (walls, floors,
 * sectors, lighting). Real GLB assets from the local 3DPSX asset
 * library drive the enemies and weapon viewmodels — that's the
 * "procedural AND mod" mix the user asked for.
 *
 * Animation names below were extracted directly from the GLB
 * binaries; they are NOT guesses. See the comment block at the top
 * of each ENEMY_MODELS entry for the full list each rig ships.
 */

import type { EnemyKind } from "./engine";
import type { WeaponId } from "./weapons";

// Vite resolves `import.meta.env.BASE_URL` to "/" in dev/build and to
// "/objexoom/" in the gh-pages build. Three's loaders (useGLTF /
// GLTFLoader) don't honor Vite's base, so we prefix it explicitly on
// every asset URL. Local helper keeps the URL constants below readable.
const A = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

export type EnemyAnimSet = {
	idle: string;
	walk: string;
	attack: string;
	hit: string;
	death: string;
};

export type EnemySkin = {
	/** Public URL (served from `public/assets/models/enemies/`). */
	url: string;
	/** Target world-space height of the rendered mesh, in OBJEXOOM tiles. */
	heightTiles: number;
	/** Drawn-rotation offset applied after facing direction. */
	yawOffsetRad: number;
	/** Vertical lift so the feet sit on (or above) the floor. */
	floorOffset: number;
	/**
	 * Mapping of FSM-equivalent states to the GLB's named animations.
	 * Empty strings are allowed when the rig ships without that anim
	 * (renderer falls back to idle). When the GLB has no animations at
	 * all, leave every field empty — the renderer will draw the static
	 * pose with a slight idle bob.
	 */
	anims: EnemyAnimSet;
};

/** Per-kind roster of visual skins — variant picked by enemy.id. */
export type EnemyModel = {
	/**
	 * Primary skin (preserved for the prior single-skin call sites).
	 * The roster includes this skin as the first entry plus any extras.
	 */
	url: string;
	heightTiles: number;
	yawOffsetRad: number;
	floorOffset: number;
	anims: EnemyAnimSet;
	/**
	 * Expanded roster of variant skins. The renderer cycles by enemy id
	 * so the player sees a mix on every level. Includes the primary
	 * skin as element 0.
	 */
	roster: EnemySkin[];
};

/**
 * Skeleton (Fantasy/PSX Dungeon Skeleton Warrior):
 *   anims: A-Pose, A-Pose.001, Death_1, Death_2, Hit_1, Hit_2,
 *          Idle_1, Idle_1_break, Idle_2, Roar,
 *          Sword_attack_1, Sword_attack_2, Sword_attack_3_combo,
 *          Unarmed_attack_1, Unarmmed_Attack_2, Walk_1, Walk_2
 *
 * Imp (Fantasy/Knight):
 *   anims: Attack_1, Attack_2, Attack_3, Combat_Bkwd_Step,
 *          Combat_Fwd_Step, Combat_Idle, Combat_Left_Step,
 *          Combat_Right_Step, Death_1, Death_2, Death_3,
 *          Hit_Back, Hit_Blocked, Hit_front, Idle_1, Idle_2,
 *          Run, T_Pose, Walk
 *
 * Wraith (Fantasy/Bat):
 *   anims: Bat_attack, Bat_Death, Bat_Dodge, Bat_Hit,
 *          Bat_Idle, Bat_Sleep, Bat_Sleep_to_idle
 */
// Reusable empty animation set for skins that ship only a T-Pose
// or no animations at all. The renderer detects this and falls back
// to a static-with-bob render.
const NO_ANIMS: EnemyAnimSet = {
	idle: "",
	walk: "",
	attack: "",
	hit: "",
	death: "",
};

const SKELETON_SKINS: EnemySkin[] = [
	{
		url: A("/assets/models/enemies/skeleton.glb"),
		heightTiles: 1.6,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: {
			idle: "Idle_1",
			walk: "Walk_1",
			attack: "Sword_attack_1",
			hit: "Hit_1",
			death: "Death_1",
		},
	},
	{
		// Sewerfiend — rigged horror creature, perfect melee enemy.
		url: A("/assets/models/enemies/horror/sewerfiend.glb"),
		heightTiles: 1.5,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: {
			idle: "Idle",
			walk: "Walk",
			attack: "Attack",
			hit: "Idle",
			death: "Die",
		},
	},
	{
		// Horned creature — wide static silhouette, no anims (procedural bob).
		url: A("/assets/models/enemies/horror/horned.glb"),
		heightTiles: 1.7,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		// Nun — narrow vertical silhouette, no anims.
		url: A("/assets/models/enemies/horror/nun.glb"),
		heightTiles: 1.8,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
];

const IMP_SKINS: EnemySkin[] = [
	{
		url: A("/assets/models/enemies/imp.glb"),
		heightTiles: 1.7,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: {
			idle: "Combat_Idle",
			walk: "Run",
			attack: "Attack_1",
			hit: "Hit_front",
			death: "Death_1",
		},
	},
	{
		// Plague doctor — converted from rigged FBX; mixamo anim track
		// names collapsed to "mixamo.com" during conversion. Renderer
		// falls back to static-with-bob via NO_ANIMS until we resolve
		// proper track-renaming.
		url: A("/assets/models/enemies/horror/plague_doctor.glb"),
		heightTiles: 1.8,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		// Elk demon — same mixamo collapse; static render for now.
		url: A("/assets/models/enemies/horror/elk_demon.glb"),
		heightTiles: 1.9,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		url: A("/assets/models/enemies/horror/abomination.glb"),
		heightTiles: 1.7,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		url: A("/assets/models/enemies/horror/abomination2.glb"),
		heightTiles: 1.4,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		url: A("/assets/models/enemies/horror/anomaly.glb"),
		heightTiles: 1.4,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		url: A("/assets/models/enemies/horror/clown_1.glb"),
		heightTiles: 1.5,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
	{
		url: A("/assets/models/enemies/horror/clown_3.glb"),
		heightTiles: 1.5,
		yawOffsetRad: 0,
		floorOffset: 0,
		anims: NO_ANIMS,
	},
];

const WRAITH_SKINS: EnemySkin[] = [
	{
		url: A("/assets/models/enemies/wraith.glb"),
		// Bat is tiny; render larger so it reads at gameplay scale.
		heightTiles: 1.1,
		yawOffsetRad: 0,
		floorOffset: 0.4,
		anims: {
			idle: "Bat_Idle",
			walk: "Bat_Idle",
			attack: "Bat_attack",
			hit: "Bat_Hit",
			death: "Bat_Death",
		},
	},
	{
		// Alien invader — tall thin silhouette, floats well as a wraith.
		url: A("/assets/models/enemies/horror/alien.glb"),
		heightTiles: 1.6,
		yawOffsetRad: 0,
		floorOffset: 0.6,
		anims: NO_ANIMS,
	},
];

export const ENEMY_MODELS: Record<EnemyKind, EnemyModel> = {
	skeleton: { ...SKELETON_SKINS[0], roster: SKELETON_SKINS },
	imp: { ...IMP_SKINS[0], roster: IMP_SKINS },
	wraith: { ...WRAITH_SKINS[0], roster: WRAITH_SKINS },
};

export type WeaponModel = {
	url: string;
	/**
	 * Euler rotation (rad) applied to align the GLB's "barrel-forward"
	 * axis with camera-forward (-Z in camera-local space).
	 * Pose only — scale is auto-derived from bbox by the viewmodel.
	 */
	rotation: [number, number, number];
	/** Offset in screen-relative camera space (right, up, -forward). */
	offset: [number, number, number];
};

/**
 * Pose-only entries — the viewmodel auto-normalizes scale via bbox.
 * GLB barrel orientations (measured from `position.min`/`max` axis spread):
 *   pistol  (USP)     : 0.86 × 3.10 × 4.64 — long axis Z (barrel +Z)
 *   chaingun (Uzi)    : 2.10 × 8.96 × 14.35 — long axis Z (barrel +Z)
 *   shotgun           : 2.04 × 4.57 × 27.35 — long axis Z (barrel +Z)
 *
 * Camera-forward in three.js is -Z. We rotate Y by π so +Z (barrel)
 * becomes -Z (camera-forward). The X +0.18 nose-down gives the slight
 * "hip-hold" DOOM tilt.
 */
export const WEAPON_MODELS: Record<WeaponId, WeaponModel> = {
	pistol: {
		url: A("/assets/models/weapons/pistol.glb"),
		rotation: [0.15, Math.PI, 0],
		offset: [0.18, -0.16, -0.38],
	},
	chaingun: {
		url: A("/assets/models/weapons/chaingun.glb"),
		rotation: [0.15, Math.PI, 0],
		offset: [0.18, -0.16, -0.38],
	},
	shotgun: {
		url: A("/assets/models/weapons/shotgun.glb"),
		rotation: [0.15, Math.PI, 0],
		offset: [0.18, -0.16, -0.38],
	},
};

export const PROP_MODELS = {
	door: A("/assets/models/props/door.glb"),
	doorLocked: A("/assets/models/props/door_locked.glb"),
	lampOn: A("/assets/models/props/lamp_on.glb"),
	lampOff: A("/assets/models/props/lamp_off.glb"),
} as const;

/**
 * Preload list — caller can pass these to drei's `useGLTF.preload`
 * during the lazy-load splash screen so the first enemy spawn doesn't
 * stall on a network fetch.
 */
export const ALL_MODEL_URLS: readonly string[] = [
	...Object.values(ENEMY_MODELS).flatMap((m) => m.roster.map((s) => s.url)),
	...Object.values(WEAPON_MODELS).map((m) => m.url),
	...Object.values(PROP_MODELS),
];

/**
 * Deterministic skin picker: every enemy with the same `id` always
 * renders with the same skin, but the spread across the roster gives
 * a packed level a varied silhouette.
 */
export function pickEnemySkin(kind: EnemyKind, id: number): EnemySkin {
	const model = ENEMY_MODELS[kind];
	return model.roster[Math.abs(id) % model.roster.length];
}
