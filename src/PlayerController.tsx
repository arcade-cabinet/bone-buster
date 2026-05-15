import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { PLAYER_HEIGHT, PLAYER_MOVE_SPEED, PLAYER_TURN_SENSITIVITY } from "./constants";
import {
	computePortalEdges,
	getFloorHeightAtAny,
	isInWaterAt,
	type ObjexoomMap,
	resolveCollisionAny,
	WATER_SPEED_MULTIPLIER,
} from "./engine";
import { addObjexoomListener, dispatch } from "./events";
import type { ObjexoomSettings } from "./settings";

type Props = Readonly<{
	map: ObjexoomMap;
	active: boolean;
	hasKey: boolean;
	settings: ObjexoomSettings;
}>;

// H3 — jump physics. World-space units (1 unit ≈ 1 m of game world).
const GRAVITY = 18; // m/s² — slightly punchier than real gravity for FPS feel
const JUMP_VELOCITY = 6.2; // gives ~1.1 m peak from rest
const PITCH_CLAMP = 1.4; // J7 — ref's PointerLockControls hard clamp
// H4 — fell-to-death threshold. If the player drifts more than this far
// below the local floor for more than FALL_GRACE_MS, they die.
const FALL_DEATH_DEPTH = 4;
const FALL_GRACE_MS = 300;
// J6 — head bob. Small sinusoid keyed to lateral speed.
const HEAD_BOB_AMPLITUDE = 0.04;
const HEAD_BOB_FREQ = 6; // Hz
// I6 — camera shake. Damage feeds into a shake amount that decays per
// second; per-frame XZ jitter is `± shake * sin(now * 40)`.
const SHAKE_DECAY = 4; // shake units / sec
const SHAKE_MAX = 0.6; // hard cap so a death blow doesn't catapult the camera

const isCoarsePointer = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(pointer: coarse)").matches;

const prefersReducedMotion = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function PlayerController({ map, active, hasKey, settings }: Props) {
	const camera = useThree((s) => s.camera);
	const gl = useThree((s) => s.gl);
	const keys = useRef<Record<string, boolean>>({});
	const yaw = useRef(map.playerYaw);
	const pitch = useRef(0);
	const moveStick = useRef({ x: 0, y: 0 });
	const lookStick = useRef({ x: 0, y: 0 });

	// H2/H3/H4 — vertical state.
	const verticalVelocity = useRef(0);
	const grounded = useRef(true);
	const bobPhase = useRef(0);
	const belowFloorSince = useRef<number | null>(null);

	// I6 — camera shake. Increments on hit (via objexoom:shake event),
	// decays at `SHAKE_DECAY` per second, and jitters X+Z each frame.
	const shakeRef = useRef(0);

	// Portals are static per sector map; precompute once. Grid maps don't need
	// them (collision is grid-cell based).
	const portals = useMemo(
		() => (map.kind === "sectors" ? computePortalEdges(map) : new Set<string>()),
		[map],
	);

	useEffect(() => {
		const onDown = (e: KeyboardEvent) => {
			keys.current[e.code] = true;
		};
		const onUp = (e: KeyboardEvent) => {
			keys.current[e.code] = false;
		};
		window.addEventListener("keydown", onDown);
		window.addEventListener("keyup", onUp);
		return () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
		};
	}, []);

	// Pointer lock — desktop only (skip on coarse pointers).
	useEffect(() => {
		if (isCoarsePointer()) return;
		const canvas = gl.domElement;
		const requestLock = () => {
			if (!active) return;
			canvas.requestPointerLock?.();
		};
		canvas.addEventListener("click", requestLock);
		return () => canvas.removeEventListener("click", requestLock);
	}, [gl, active]);

	useEffect(() => {
		if (!active) return;
		const onMouseMove = (e: MouseEvent) => {
			if (!document.pointerLockElement) return;
			const sens = PLAYER_TURN_SENSITIVITY * settings.mouseSensitivity;
			yaw.current -= e.movementX * sens;
			pitch.current -= e.movementY * sens;
			pitch.current = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch.current));
		};
		const onClick = (e: MouseEvent) => {
			if (!document.pointerLockElement) return;
			if (e.button !== 0) return;
			dispatch({ type: "fire" });
		};
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mousedown", onClick);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mousedown", onClick);
		};
	}, [active, settings.mouseSensitivity]);

	// H3 — Space (or mobile "objexoom:jump" event) triggers a jump if grounded.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.code === "Space" && active && grounded.current) {
				verticalVelocity.current = JUMP_VELOCITY;
				grounded.current = false;
			}
		};
		const teardownJump = addObjexoomListener("jump", () => {
			if (active && grounded.current) {
				verticalVelocity.current = JUMP_VELOCITY;
				grounded.current = false;
			}
		});
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			teardownJump();
		};
	}, [active]);

	// Debug teleport (e2e harness).
	useEffect(() => {
		return addObjexoomListener("teleport", ({ x, y, yaw: newYaw }) => {
			camera.position.x = x;
			camera.position.z = y;
			const floor = getFloorHeightAtAny(map, { x, y }) ?? 0;
			camera.position.y = floor + PLAYER_HEIGHT;
			verticalVelocity.current = 0;
			grounded.current = true;
			belowFloorSince.current = null;
			if (newYaw != null) yaw.current = newYaw;
		});
	}, [camera, map]);

	// Virtual joystick events from the HUD (mobile / coarse pointer).
	useEffect(() => {
		const teardownMove = addObjexoomListener("move", ({ x, y }) => {
			moveStick.current = { x, y };
		});
		const teardownLook = addObjexoomListener("look", ({ x, y }) => {
			lookStick.current = { x, y };
		});
		return () => {
			teardownMove();
			teardownLook();
		};
	}, []);

	// I6 + POL15 — listen for damage shake events. The pre-POL15
	// implementation scaled linearly (0.15 per hp). Modernized DOOM
	// uses a non-linear curve so light taps feel quiet and heavy hits
	// hit HARD — small damages stay subtle, big damages punch above
	// the linear baseline.
	//
	// Curve: add = 0.08 * amount + 0.018 * amount^1.7
	//   1 hp → 0.098 (was 0.15 — quieter)
	//   3 hp → 0.34  (was 0.45 — quieter)
	//   6 hp → 0.79 → clamps to SHAKE_MAX (was 0.90 → clamped)
	//   9 hp → 1.45 → clamps to SHAKE_MAX (was 1.35 → clamped)
	// Net effect: small hits feel ambient, big hits saturate the cap
	// faster (so a chaingun spray taps quietly but a shotgun pellet
	// barrage snaps the camera). Decay rate unchanged.
	useEffect(() => {
		return addObjexoomListener("shake", ({ amount }) => {
			const a = Math.max(0, amount);
			const add = 0.08 * a + 0.018 * a ** 1.7;
			shakeRef.current = Math.min(SHAKE_MAX, shakeRef.current + add);
		});
	}, []);

	useFrame((_, deltaSeconds) => {
		if (!active) return;
		const dt = Math.min(0.05, deltaSeconds);

		// Look stick (touch input) → yaw/pitch.
		const touchSens = settings.touchLookSensitivity;
		yaw.current -= lookStick.current.x * 2.4 * touchSens * dt;
		pitch.current -= lookStick.current.y * 1.6 * touchSens * dt;
		pitch.current = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch.current));

		camera.rotation.order = "YXZ";
		camera.rotation.y = yaw.current;
		camera.rotation.x = pitch.current;

		// Horizontal input.
		let fx = 0;
		let fz = 0;
		if (keys.current.KeyW || keys.current.ArrowUp) fz -= 1;
		if (keys.current.KeyS || keys.current.ArrowDown) fz += 1;
		if (keys.current.KeyA || keys.current.ArrowLeft) fx -= 1;
		if (keys.current.KeyD || keys.current.ArrowRight) fx += 1;
		fx += moveStick.current.x;
		fz += moveStick.current.y;
		const mag = Math.hypot(fx, fz);
		const moving = mag > 0.01;
		let lateralSpeed = 0;
		if (moving) {
			const speed = Math.min(1, mag);
			fx = (fx / mag) * speed;
			fz = (fz / mag) * speed;
			const sin = Math.sin(yaw.current);
			const cos = Math.cos(yaw.current);
			const wx = fx * cos + fz * sin;
			const wz = -fx * sin + fz * cos;
			// E7 — water slowdown. Check the current camera position (pre-
			// step) so the slowdown takes effect immediately on water entry.
			const waterMul = isInWaterAt(map, { x: camera.position.x, y: camera.position.z })
				? WATER_SPEED_MULTIPLIER
				: 1;
			const step = PLAYER_MOVE_SPEED * waterMul * dt;
			const desired = {
				x: camera.position.x + wx * step,
				y: camera.position.z + wz * step,
			};
			const resolved = resolveCollisionAny(desired, map, {
				doorOpen: hasKey,
				portals,
			});
			camera.position.x = resolved.x;
			camera.position.z = resolved.y;
			lateralSpeed = Math.hypot(
				resolved.x - desired.x + wx * step,
				resolved.y - desired.y + wz * step,
			);
		}

		// H2/H3 — vertical resolution. Sample the floor at the current XZ
		// (post-collision-resolution) and let gravity + jump velocity drive y.
		const here = { x: camera.position.x, y: camera.position.z };
		const floorY = getFloorHeightAtAny(map, here);
		const targetY = (floorY ?? 0) + PLAYER_HEIGHT;

		verticalVelocity.current -= GRAVITY * dt;
		const nextY = camera.position.y + verticalVelocity.current * dt;
		if (nextY <= targetY) {
			camera.position.y = targetY;
			verticalVelocity.current = 0;
			grounded.current = true;
		} else {
			camera.position.y = nextY;
			grounded.current = false;
		}

		// H4 — fall-to-death. If we're either outside any sector (floorY null,
		// e.g. above a pit on a ref map) OR more than FALL_DEATH_DEPTH below
		// the local floor, accumulate grace time and dispatch death.
		const now = performance.now();
		const outOfBounds = floorY === null;
		const tooDeep = floorY !== null && camera.position.y < floorY - FALL_DEATH_DEPTH;
		if (outOfBounds || tooDeep) {
			if (belowFloorSince.current === null) belowFloorSince.current = now;
			if (now - belowFloorSince.current > FALL_GRACE_MS) {
				belowFloorSince.current = null;
				dispatch({ type: "fellToDeath" });
			}
		} else {
			belowFloorSince.current = null;
		}

		// J6 — head bob. Only while grounded + moving + motion isn't reduced.
		if (grounded.current && moving && !prefersReducedMotion()) {
			bobPhase.current += dt * HEAD_BOB_FREQ * Math.PI * 2;
			camera.position.y +=
				Math.sin(bobPhase.current) * HEAD_BOB_AMPLITUDE * Math.min(1, lateralSpeed * 4);
		} else {
			// Decay phase gently so we don't snap on the next stride.
			bobPhase.current *= 0.85;
		}

		// I6 — camera shake. Decay first so a tiny carry-over doesn't pin the
		// camera permanently; then apply jitter on X+Z (Y is owned by physics
		// + head-bob and we don't want to fight either). Reduced-motion off.
		if (shakeRef.current > 0 && !prefersReducedMotion()) {
			const jitter = shakeRef.current * Math.sin(now * 0.04);
			camera.position.x += jitter;
			camera.position.z += jitter * 0.7;
			shakeRef.current = Math.max(0, shakeRef.current - SHAKE_DECAY * dt);
		} else if (shakeRef.current > 0) {
			// Reduced-motion: decay without jitter so debt clears off.
			shakeRef.current = Math.max(0, shakeRef.current - SHAKE_DECAY * dt);
		}
	});

	return null;
}
