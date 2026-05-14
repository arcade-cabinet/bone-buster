/**
 * OBJEXOOM color tokens.
 *
 * OBJEXOOM's palette inherits its lineage from Objexiv — the indigo +
 * violet axis is preserved as a tribute — but the standalone game is
 * dark-mode-only and horror-flavored, so the relationship inverts:
 *
 *   Objexiv:  light backgrounds, indigo+violet as PRIMARY action color.
 *   OBJEXOOM: deep-ink backgrounds, indigo+violet as ACCENT (HUD chrome,
 *             menu highlights, ambient lighting), BLOOD as the action
 *             color (low-health warning, damage flash, enemy emissive),
 *             AMBER as the friendly attractor (pickups, key acquired,
 *             fire), and EMBER as the lava + going-back-strobe color.
 *
 * Every hex below is either:
 *   (a) inherited verbatim from Objexiv (and tagged so refactors notice)
 *   (b) a deliberate OBJEXOOM extension that maintains the same hue family
 *
 * Color values come in scales (50–950 a la Tailwind) so we can pick
 * roles consistently and so derived shades stay in tune.
 */

/**
 * Anchor pairs we kept from Objexiv. These are the lineage hooks.
 * Touching them changes how the two products relate visually — don't
 * tweak without a brand decision.
 */
export const LINEAGE = {
	objexivIndigo: "#6172f3",
	objexivViolet: "#a855f7",
	objexivLavender: "#a78bfa",
	objexivAmber: "#f59e0b",
	objexivInk: "#060912",
	objexivGradient: "linear-gradient(135deg, #6172f3, #a855f7)",
	objexivGradientWarm: "linear-gradient(135deg, #6172f3, #a855f7, #f59e0b)",
} as const;

/**
 * OBJEXOOM-native scales. Each scale is a perceptually-uniform 11-step
 * derived from a single anchor hue. Use roles below, not the raw
 * scale values, in component code.
 */
export const SCALE = {
	// Deep navy → near-black. Backgrounds, walls, world ambient.
	ink: {
		50: "#e7e9f3",
		100: "#c6cae0",
		200: "#959cc2",
		300: "#646da3",
		400: "#3f4880",
		500: "#252e5e",
		600: "#171f47",
		700: "#0e1432",
		800: "#080c20",
		900: "#060912", // = LINEAGE.objexivInk
		950: "#03050b",
	},
	// Cool secondary — HUD chrome, menu highlights, ambient sky.
	indigo: {
		50: "#eef0fe",
		100: "#d4d8fd",
		200: "#a4adfb",
		300: "#7c89f8",
		400: "#6172f3", // = LINEAGE.objexivIndigo
		500: "#4f52e7",
		600: "#4338ca",
		700: "#372cad",
		800: "#251e7e",
		900: "#16114e",
		950: "#0c0830",
	},
	// Headlining accent — wordmark, hero CTAs, key UI moments.
	violet: {
		50: "#f5edff",
		100: "#e5d3ff",
		200: "#cba9ff",
		300: "#b681fb",
		400: "#a855f7", // = LINEAGE.objexivViolet
		500: "#9333ea",
		600: "#7d22d4",
		700: "#5e1bae",
		800: "#3f1480",
		900: "#260c50",
		950: "#160630",
	},
	// Friendly attractor — pickups, KEY ACQUIRED, fire muzzle, weapon hot key.
	amber: {
		50: "#fff7e0",
		100: "#fde6a8",
		200: "#fbcd6a",
		300: "#fab436",
		400: "#f59e0b", // = LINEAGE.objexivAmber
		500: "#d97706",
		600: "#b45309",
		700: "#854212",
		800: "#572c12",
		900: "#2e1808",
		950: "#190d04",
	},
	// Action / damage / low-health / enemy emissive (the DOOM red).
	// New axis OBJEXOOM brings on top of Objexiv's gradient.
	blood: {
		50: "#fdecec",
		100: "#fbcccc",
		200: "#f59595",
		300: "#ef5e5e",
		400: "#dc2626",
		500: "#b91c1c", // anchor — most damage flashes
		600: "#991b1b",
		700: "#7f1d1d",
		800: "#581616",
		900: "#330d0d",
		950: "#1a0606",
	},
	// Hot/lava/going-back-strobe — between amber and blood.
	ember: {
		50: "#fff1e7",
		100: "#ffd8b5",
		200: "#ffba7a",
		300: "#ff9849",
		400: "#ff7518", // anchor — lava emissive
		500: "#e5570d",
		600: "#bd3e08",
		700: "#8e2d06",
		800: "#5d1d04",
		900: "#310f02",
		950: "#180701",
	},
	// Neutral cool — body text, HUD readouts on top of ink.
	parchment: {
		50: "#fafbff",
		100: "#f3eedd", // legacy parchment (used in HUD)
		200: "#e5e0cf",
		300: "#c8c2b0",
		400: "#a8a290",
		500: "#878270",
		600: "#6b6759",
		700: "#504c40",
		800: "#363328",
		900: "#1c1a13",
		950: "#0c0b07",
	},
} as const;

/**
 * Semantic role tokens — what code SHOULD reference. These map to a
 * specific shade in a scale so swapping the underlying scale value
 * propagates everywhere consistently.
 */
export const ROLE = {
	// Backgrounds
	bgVoid: SCALE.ink[950], // deepest, behind everything
	bgWorld: SCALE.ink[900], // game world ambient (= Objexiv ink)
	bgWall: SCALE.ink[700], // wall fill in sectors / corridors
	bgPanel: SCALE.ink[800], // HUD card / menu card background
	bgPanelAlpha: "rgba(8, 12, 32, 0.78)", // HUD card translucent

	// Text
	textPrimary: SCALE.parchment[100],
	textSecondary: SCALE.parchment[300],
	textMuted: SCALE.parchment[500],
	textHighContrast: SCALE.parchment[50],

	// Accents (HUD chrome, link highlights)
	accentCool: SCALE.indigo[400], // = Objexiv indigo, our chrome accent
	accentPrimary: SCALE.violet[400], // = Objexiv violet, our hero accent

	// Action / state
	actionFire: SCALE.blood[500], // muzzle flash + bullet hit
	actionDamage: SCALE.blood[600], // damage flash overlay
	actionHurt: SCALE.blood[300], // low HP warning text
	actionKey: SCALE.amber[400], // KEY ACQUIRED indicator
	actionPickup: SCALE.amber[300], // pickup glow
	actionLava: SCALE.ember[400], // lava emissive
	actionWin: SCALE.indigo[300], // win overlay accent (echoes Objexiv)
	actionGoingBack: SCALE.ember[500], // going-back-strobe color

	// Strokes / borders
	borderSoft: "rgba(124, 137, 248, 0.18)", // indigo-tinted at low alpha
	borderHard: SCALE.indigo[700],

	// Brand surfaces
	heroGradient: "linear-gradient(135deg, #6172f3 0%, #a855f7 50%, #f59e0b 100%)",
	heroGradientCool: "linear-gradient(135deg, #6172f3 0%, #a855f7 100%)",
	heroGradientHot: "linear-gradient(135deg, #a855f7 0%, #f59e0b 60%, #dc2626 100%)",
	// Wordmark gradient — direct homage to Objexiv's gradient but
	// pushed warmer at the right end to mark OBJEXOOM's identity.
	wordmarkGradient: "linear-gradient(95deg, #7c89f8 0%, #b681fb 35%, #f59e0b 75%, #ff7518 100%)",
} as const;

/**
 * Back-compat alias — `OBJEXOOM_PALETTE` was a flat object literal in
 * the original Objexiv-embedded version. Keep the same keys exported
 * so the existing call sites (`OBJEXOOM_PALETTE.violet`, etc.) work
 * without a code-wide rename. Values now resolve through the scale.
 */
export const OBJEXOOM_PALETTE = {
	indigo: SCALE.indigo[400],
	violet: SCALE.violet[400],
	amber: SCALE.amber[400],
	ink: SCALE.ink[900],
	parchment: SCALE.parchment[100],
	// DS.7 — semantic anchors used by the 3D scene. These appeared as
	// raw hex literals scattered across map/entities/effects before the
	// token rollout. Promoted here so brand tweaks ripple everywhere.
	wallShadow: SCALE.ink[800], // "#080c20" — floor + ceiling base
	wallBase: SCALE.ink[700], // "#0e1432" ≈ "#0b1024" — backdrop fill
	wallVariantCool: "#1f2547", // cooler-tinted wall variant
	wallVariantWarm: "#26224a", // warmer-tinted wall variant
	wallVariantNeutral: "#1a1e3b", // neutral mid wall variant
	wallEmissive: "#1a1f3a", // floor emissive cool blue
	door: "#231a3f", // locked-door darker indigo
	flashlightWarm: SCALE.parchment[50], // "#fef3c7" — flashlight + amber lens
	weaponMetalLight: "#3a3a48", // pistol untextured metal
	weaponMetalDark: "#1f2230", // chaingun/shotgun untextured metal
	ammoBrass: "#b16a14", // shotgun shell brass
	chestWood: "#3a2a14", // treasure chest body
	chestWoodDeep: "#241a0a", // treasure chest band
	portalTeal: "#22d3a8", // ExitPortal hue variant
	portalRose: "#f43f5e", // ExitPortal hue variant
} as const;

export type ScaleStep = keyof typeof SCALE.ink;
export type ScaleName = keyof typeof SCALE;
