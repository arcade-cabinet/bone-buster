import { LINEAGE, ROLE, SCALE } from "./design-tokens";

export type WeaponId = "melee" | "pistol" | "chaingun" | "shotgun";

export type WeaponSpec = Readonly<{
	id: WeaponId;
	label: string;
	cooldownMs: number;
	damage: number;
	pellets: number; // 1 = hitscan single, >1 = shotgun spread
	spreadRad: number;
	rangeTiles: number;
	ammoCostPerShot: number;
	startingAmmo: number;
	pickupAmmo: number;
	muzzleColor: string;
	hudHotkey: string;
}>;

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
	melee: {
		id: "melee",
		label: "BLADE",
		// E1 — slow swing (no skill ceiling matching the pistol). Tuned so
		// you'd rather draw the pistol against anything that isn't already
		// at point-blank, but you reach for the blade when ammo runs dry.
		cooldownMs: 420,
		damage: 55,
		pellets: 1,
		spreadRad: 0.08,
		rangeTiles: 1.6,
		ammoCostPerShot: 0,
		startingAmmo: Number.POSITIVE_INFINITY,
		pickupAmmo: 0,
		// scale-step: muzzle-flash hue wants a slightly lighter red than
		// ROLE.actionFire (blood[500]) so the BLADE swing reads warm-but-not-arterial.
		muzzleColor: SCALE.blood[400],
		hudHotkey: "1",
	},
	pistol: {
		id: "pistol",
		label: "PISTOL",
		cooldownMs: 250,
		damage: 25,
		pellets: 1,
		spreadRad: 0.005,
		rangeTiles: 18,
		ammoCostPerShot: 0,
		startingAmmo: Number.POSITIVE_INFINITY,
		pickupAmmo: 0,
		muzzleColor: LINEAGE.objexivIndigo,
		hudHotkey: "2",
	},
	chaingun: {
		id: "chaingun",
		label: "CHAINGUN",
		cooldownMs: 90,
		damage: 18,
		pellets: 1,
		spreadRad: 0.06,
		rangeTiles: 22,
		// L3 — chaingun is unlimited in the reference (no ammo cost once
		// owned). Once you pick one up, it's a permanent weapon.
		ammoCostPerShot: 0,
		startingAmmo: Number.POSITIVE_INFINITY,
		pickupAmmo: 0,
		muzzleColor: ROLE.accentPrimary,
		hudHotkey: "3",
	},
	shotgun: {
		id: "shotgun",
		label: "SHOTGUN",
		cooldownMs: 700,
		damage: 14,
		pellets: 7,
		spreadRad: 0.22,
		rangeTiles: 12,
		ammoCostPerShot: 1,
		startingAmmo: 0,
		pickupAmmo: 8,
		muzzleColor: ROLE.actionKey,
		hudHotkey: "4",
	},
};

export const WEAPON_ORDER: readonly WeaponId[] = ["melee", "pistol", "chaingun", "shotgun"];
