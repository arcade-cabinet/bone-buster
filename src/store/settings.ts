export type Difficulty =
	| "tooYoung"
	| "notTooRough"
	| "hurtMePlenty"
	| "ultraViolence"
	| "nightmare";

export type LevelChoice = "procedural" | 1 | 2 | 3 | 4 | 5;

// BC5 — touch-control mode. `auto` runs the broadened media-query
// gate (covers desktops, tablets, foldables in unfolded mode, and
// every phone form factor); `on` pins the touch HUD even on a
// desktop browser (useful for screenshot work + Pixel Fold inner-
// display previews on Chrome desktop with no coarse pointer); `off`
// forces the keyboard+mouse HUD even on tablets (useful when a
// Bluetooth keyboard is paired).
export type TouchControlMode = "auto" | "on" | "off";

export type BoneBusterSettings = Readonly<{
	difficulty: Difficulty;
	level: LevelChoice;
	soundEnabled: boolean;
	mouseSensitivity: number; // 0.5 → 2.5
	touchLookSensitivity: number; // 0.5 → 4
	touchControls: TouchControlMode;
}>;

// H1 — reference levels are the default. Procedural mode is the
// deliberate opt-in via the RANDOM chip on the landing's level pane.
// Reason: hand-authored ref geometry is the canonical OBJEXOOM
// gameplay; the procedural grid is a sandbox alternative.
export const DEFAULT_SETTINGS: BoneBusterSettings = {
	difficulty: "hurtMePlenty",
	level: 1,
	soundEnabled: true,
	mouseSensitivity: 1,
	touchLookSensitivity: 1.6,
	touchControls: "auto",
};

export const TOUCH_CONTROL_LABEL: Record<TouchControlMode, string> = {
	auto: "AUTO",
	on: "ALWAYS ON",
	off: "ALWAYS OFF",
};

export const TOUCH_CONTROL_BLURB: Record<TouchControlMode, string> = {
	auto: "Detect touch input automatically. Foldables + phones get sticks; desktops get keyboard.",
	on: "Force on-screen sticks. Useful for previewing the touch HUD on a desktop browser.",
	off: "Force keyboard + mouse. Useful when a Bluetooth keyboard is paired to a tablet.",
};

export type DifficultyTuning = Readonly<{
	enemyHpMultiplier: number;
	enemyDamageMultiplier: number;
	enemyCountMultiplier: number;
	playerHpMultiplier: number;
	// I5 — i-frame window after a player hit; enemies can't multi-tick
	// damage faster than this. Ref formula: `450 - 50 * difficultyIndex`
	// where index 0=tooYoung … 4=nightmare.
	playerIframeMs: number;
}>;

export const DIFFICULTY_TUNING: Record<Difficulty, DifficultyTuning> = {
	tooYoung: {
		enemyHpMultiplier: 0.55,
		enemyDamageMultiplier: 0.5,
		enemyCountMultiplier: 0.6,
		playerHpMultiplier: 1.5,
		playerIframeMs: 450,
	},
	notTooRough: {
		enemyHpMultiplier: 0.8,
		enemyDamageMultiplier: 0.75,
		enemyCountMultiplier: 0.8,
		playerHpMultiplier: 1.2,
		playerIframeMs: 400,
	},
	hurtMePlenty: {
		enemyHpMultiplier: 1,
		enemyDamageMultiplier: 1,
		enemyCountMultiplier: 1,
		playerHpMultiplier: 1,
		playerIframeMs: 350,
	},
	ultraViolence: {
		enemyHpMultiplier: 1.3,
		enemyDamageMultiplier: 1.3,
		enemyCountMultiplier: 1.3,
		playerHpMultiplier: 0.85,
		playerIframeMs: 300,
	},
	nightmare: {
		enemyHpMultiplier: 1.6,
		enemyDamageMultiplier: 1.6,
		enemyCountMultiplier: 1.6,
		playerHpMultiplier: 0.6,
		playerIframeMs: 250,
	},
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
	tooYoung: "I'M TOO YOUNG TO DIE",
	notTooRough: "HEY, NOT TOO ROUGH",
	hurtMePlenty: "HURT ME PLENTY",
	ultraViolence: "ULTRA-VIOLENCE",
	nightmare: "NIGHTMARE!",
};

export const DIFFICULTY_BLURB: Record<Difficulty, string> = {
	tooYoung: "Half damage. More health. Walk it off.",
	notTooRough: "Lighter sting. The standard for first runs.",
	hurtMePlenty: "Balanced. The fair fight.",
	ultraViolence: "More of them, hitting harder.",
	nightmare: "They respawn? No. But they hit like it.",
};

export const LEVEL_LABEL: Record<LevelChoice, string> = {
	procedural: "RANDOM",
	1: "E1M1",
	2: "E1M2",
	3: "E1M3",
	4: "E1M4",
	5: "E1M5",
};
