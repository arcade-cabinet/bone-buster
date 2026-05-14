// Public entry — re-exports for any consumer that wants to embed the
// game in its own React tree. The standalone Vite app instead mounts
// `<ObjexoomShell />` directly from `app/main.tsx`.
export { ObjexoomShell } from "./ObjexoomShell";
export type { GameRef, LevelPhase, WeaponState } from "./ObjexoomShell";
