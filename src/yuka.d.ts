// Y7/Y8 — minimal Yuka type declarations. The upstream `yuka` package
// has no shipped types; we use only the EntityManager / Time / Vector3
// surface here, so the rest is left as `any` to keep the migration
// scope contained. Expand this as more yuka features come online
// (Y1-Y6 follow-ups will need StateMachine, Vehicle, NavMesh, etc).
declare module "yuka" {
	export class Vector3 {
		x: number;
		y: number;
		z: number;
		constructor(x?: number, y?: number, z?: number);
		set(x: number, y: number, z: number): this;
		copy(v: Vector3): this;
		add(v: Vector3): this;
		subVectors(a: Vector3, b: Vector3): this;
		multiplyScalar(s: number): this;
		normalize(): this;
		length(): number;
	}

	export class GameEntity {
		position: Vector3;
		uuid: string;
		update(delta: number): this;
	}

	export class EntityManager {
		entities: GameEntity[];
		add(entity: GameEntity): this;
		remove(entity: GameEntity): this;
		clear(): this;
		update(delta: number): this;
	}

	export class Time {
		update(): this;
		getDelta(): number;
	}

	export const MathUtils: {
		clamp(value: number, min: number, max: number): number;
	};
}
