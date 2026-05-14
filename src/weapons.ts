export type WeaponId = "pistol" | "chaingun" | "shotgun";

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
		muzzleColor: "#6172f3",
		hudHotkey: "1",
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
		muzzleColor: "#a855f7",
		hudHotkey: "2",
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
		muzzleColor: "#f59e0b",
		hudHotkey: "3",
	},
};

export const WEAPON_ORDER: readonly WeaponId[] = [
	"pistol",
	"chaingun",
	"shotgun",
];
