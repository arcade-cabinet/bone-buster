// POL11 — minimal troika-three-text type declarations. The upstream package
// ships no types (drei previously vendored the typed <Text> wrapper). We
// construct the troika `Text` mesh directly to avoid drei's suspending
// `preloadFont` path (see DamageNumberField.tsx), so we declare just the
// instance surface the damage-number frame loop mutates plus the THREE.Object3D
// shape R3F needs for <primitive object={...}>.
declare module "troika-three-text" {
	import type { Object3D } from "three";
	export class Text extends Object3D {
		text: string;
		font: string | null;
		fontSize: number;
		fontWeight: number | "normal" | "bold";
		color: string | number | null;
		fillOpacity: number;
		outlineWidth: number | string;
		outlineColor: string | number;
		outlineOpacity: number;
		anchorX: number | "center" | "left" | "right" | string;
		anchorY: number | "middle" | "top" | "bottom" | string;
		sync(callback?: () => void): void;
		dispose(): void;
	}
	export function preloadFont(
		options: { font?: string; characters?: string | string[] },
		callback: () => void,
	): void;
}
