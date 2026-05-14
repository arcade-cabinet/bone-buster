// Barrel re-export for the scene/ subtree. The scene root
// (`ObjexoomScene.tsx`) imports from here so it doesn't need to know
// the folder layout — drop-in moves of individual components stay
// internal.
export { WALL_HEIGHT } from "./constants";
export { AdaptiveResolution } from "./effects/AdaptiveResolution";
export { BodyPartField } from "./effects/BodyPartField";
export { BulletField } from "./effects/BulletField";
export { Flashlight } from "./effects/Flashlight";
export { ParticleBurstField } from "./effects/ParticleBurstField";
export { ShellEjectField } from "./effects/ShellEjectField";
export { BarrelMesh } from "./entities/BarrelMesh";
export { DebrisField } from "./entities/DebrisField";
export { EnemyMesh } from "./entities/EnemyMesh";
export { ExitPortal } from "./entities/ExitPortal";
export { FloorTileField } from "./entities/FloorTileField";
export { KeyMarker } from "./entities/KeyMarker";
export { LampField } from "./entities/LampField";
export { PickupMesh } from "./entities/PickupMesh";
export { PropField } from "./entities/PropField";
export { RealDoor } from "./entities/RealDoor";
export { SecretField } from "./entities/SecretField";
export { TreasureChest } from "./entities/TreasureChest";
export { LockedDoor } from "./map/LockedDoor";
export { MapGeometry } from "./map/MapGeometry";
export { SectorMapGeometry } from "./map/SectorMapGeometry";
export { WeaponViewmodel } from "./viewmodel/WeaponViewmodel";
