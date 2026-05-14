/**
 * OBJEXOOM spacing + radius + elevation tokens.
 *
 * Scale is 4px-base — fine enough for HUD chrome, coarse enough that a
 * mid-tier touchscreen still hits targets cleanly. Roles below name
 * the touch-targets so component code never hardcodes a pixel value.
 */

export const SPACE = {
	"0": "0",
	px: "1px",
	"0.5": "2px",
	"1": "4px",
	"2": "8px",
	"3": "12px",
	"4": "16px",
	"5": "20px",
	"6": "24px",
	"8": "32px",
	"10": "40px",
	"12": "48px",
	"16": "64px",
	"20": "80px",
	"24": "96px",
} as const;

export const RADIUS = {
	none: "0",
	sm: "4px",
	md: "8px",
	lg: "12px",
	xl: "16px",
	"2xl": "24px",
	pill: "999px",
	circle: "50%",
} as const;

export const ELEVATION = {
	// Glow under the wordmark + win cards. Indigo + violet bleed.
	wordmark: "0 0 24px rgba(124, 137, 248, 0.25), 0 0 48px rgba(182, 129, 251, 0.18)",
	// Soft drop on HUD cards.
	hudCard: "0 8px 24px rgba(6, 9, 18, 0.55)",
	// Hard ring on enemy-damage flash (red bloom).
	damageRing: "0 0 0 4px rgba(220, 38, 38, 0.45), 0 0 24px rgba(220, 38, 38, 0.6)",
	// Pickup glow.
	pickup: "0 0 16px rgba(245, 158, 11, 0.6)",
	// Going-back strobe (ember pulse).
	strobe: "0 0 32px rgba(255, 117, 24, 0.55)",
} as const;

/** Touch targets — mid-tier device (Pixel 5a class). */
export const TOUCH = {
	stickRadius: 56,
	stickKnob: 28,
	fireButton: 88,
	weaponChip: 56,
	hudCorner: 16,
} as const;
