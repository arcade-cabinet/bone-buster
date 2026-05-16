export const TILE = 4;
export const GRID_SIZE = 12;
export const PLAYER_RADIUS = 0.8;
export const PLAYER_HEIGHT = 1.7;
// L1 — HP is a 0-9 discrete scale matching the reference's
// `update_health(+1)` pickup increment. Difficulty multipliers in
// settings.ts still apply (tooYoung gives 1.5× = 13, nightmare 0.6× = 5).
export const PLAYER_MAX_HP = 9;
export const PLAYER_MOVE_SPEED = 5.5;
export const PLAYER_TURN_SENSITIVITY = 0.002;

// L1 — enemy HP stays on its own scale; damage values to the player
// are rescaled to fit 0-9 (skeleton melee = 2 hp on Hurt Me Plenty).
export const SKELETON_HP = 40;
export const SKELETON_DAMAGE = 2;
export const SKELETON_ATTACK_RANGE = TILE * 1.1;
export const SKELETON_MOVE_SPEED = 1.8;
export const SKELETON_ATTACK_COOLDOWN_MS = 900;

export const PISTOL_DAMAGE = 25;
export const PISTOL_COOLDOWN_MS = 250;
export const PISTOL_MAX_RANGE = TILE * 18;

// Re-export from the design-tokens system so existing import sites
// (`from "@shared/constants"`) keep working while there's only one source of
// truth for color values. New code should import from
// `./design-tokens` directly and prefer `ROLE.*` over `OBJEXOOM_PALETTE.*`.
export { OBJEXOOM_PALETTE } from "@styles/tokens/colors";
