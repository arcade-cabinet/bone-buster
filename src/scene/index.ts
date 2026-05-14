// Barrel re-export for the scene/ subtree. The scene root
// (`ObjexoomScene.tsx`) imports from here so it doesn't need to know
// the folder layout — drop-in moves of individual components stay
// internal.
export { WALL_HEIGHT } from "./constants";
export { BodyPartField } from "./effects/BodyPartField";
export { BulletField } from "./effects/BulletField";
export { Flashlight } from "./effects/Flashlight";
export { ParticleBurstField } from "./effects/ParticleBurstField";
export { ShellEjectField } from "./effects/ShellEjectField";
export { EnemyMesh } from "./entities/EnemyMesh";
export { ExitPortal } from "./entities/ExitPortal";
export { KeyMarker } from "./entities/KeyMarker";
export { PickupMesh } from "./entities/PickupMesh";
export { RealDoor } from "./entities/RealDoor";
export { TreasureChest } from "./entities/TreasureChest";
export { LockedDoor } from "./map/LockedDoor";
export { MapGeometry } from "./map/MapGeometry";
export { SectorMapGeometry } from "./map/SectorMapGeometry";
export { WeaponViewmodel } from "./viewmodel/WeaponViewmodel";
