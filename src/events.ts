/**
 * ARCH1a — typed event-bus surface for the 14 `objexoom:*` channels.
 *
 * Co-exists with the existing untyped `window.dispatchEvent(new
 * CustomEvent(...))` call sites; ARCH1b migrates each call site
 * incrementally. Once the migration completes, this module is the
 * sole entry-point for cross-component event traffic.
 *
 * Channel classification (per directive ARCH1b):
 *   - particle / fanout broadcast    — multi-consumer; stay as window events
 *       burst        damage / pickup / playerHit / explode bursts (ParticleBurstField)
 *       bodyParts    death gibs                                  (BodyPartField)
 *       shellEject   shotgun/chaingun casings                    (ShellEjectField)
 *   - input bridge from PlayerController — multi-listener tolerated
 *       fire         trigger pull         (WeaponViewmodel + Scene onFire)
 *       jump         space press          (PlayerController internal)
 *       look         pointer-lock delta   (PlayerController internal)
 *       move         WASD bitmask         (PlayerController internal)
 *   - debug-hook surface — gated by ?objexoomDebug; one-to-many is fine
 *       debugKillAll          insta-kill all enemies
 *       debugCollectPickups   collect all pickups
 *   - Shell↔Scene channels — known parent; ARCH1b moves these to direct ref
 *     callbacks. Tracked here so the migration has a complete inventory.
 *       fpsUpdate    Scene → Shell FPS readout
 *       shake        Scene → Shell camera-shake trigger
 *       playerHit    Scene → Shell hit feedback
 *       fellToDeath  Scene → Shell death cause
 *       teleport     Scene → Shell teleport notification
 */

/** Camera/world bursts emitted into the particle fanout. */
export type BurstKind = "damage" | "pickup" | "playerHit" | "explode";

export interface BurstEvent {
	type: "burst";
	x: number;
	y: number;
	kind: BurstKind;
}

export interface BodyPartsEvent {
	type: "bodyParts";
	x: number;
	y: number;
	kind: string; // enemy.kind — typed loosely here to avoid pulling EnemyKind into the event module
}

export interface ShellEjectEvent {
	type: "shellEject";
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	scale: number;
}

export interface FireEvent {
	type: "fire";
}

export interface JumpEvent {
	type: "jump";
}

/**
 * Virtual-joystick look/move events from the mobile HUD sticks.
 * Both carry the same normalized [-1, 1] x/y payload. PlayerController
 * applies them per-frame to camera yaw/pitch (look) or movement (move).
 */
export interface LookEvent {
	type: "look";
	x: number;
	y: number;
}

export interface MoveEvent {
	type: "move";
	x: number;
	y: number;
}

export interface DebugKillAllEvent {
	type: "debugKillAll";
}

export interface DebugCollectPickupsEvent {
	type: "debugCollectPickups";
}

export interface PlayerHitEvent {
	type: "playerHit";
}

export interface FpsUpdateEvent {
	type: "fpsUpdate";
	fps: number;
	pixelRatio: number;
}

export interface ShakeEvent {
	type: "shake";
	// Damage amount (0-9 scale). Receiver multiplies by 0.15 to get
	// shake magnitude in world units.
	amount: number;
}

export interface FellToDeathEvent {
	type: "fellToDeath";
}

export interface TeleportEvent {
	type: "teleport";
	x: number;
	y: number;
	yaw: number | null;
}

/**
 * POL11 — floating damage number. Dispatched on every successful
 * enemy hit (one per pellet that lands), consumed by DamageNumberField
 * which renders a fade-out text label at the world position.
 */
export interface DamageNumberEvent {
	type: "damageNumber";
	x: number;
	y: number;
	amount: number;
	/** True when the hit dropped the enemy — DamageNumberField may render bigger / brighter. */
	killed: boolean;
	/**
	 * POL11-v2 — enemy id for crit-stack consolidation. Multiple pellets
	 * landing on the same enemy within a short window combine into a
	 * single running-total label rather than 8 stacked numbers.
	 * Optional so non-enemy sources (e.g. barrels, future explosive
	 * splash) can still spawn floating numbers without stacking.
	 */
	enemyId?: number;
}

/**
 * E6 — fires when a secret switch is hit by a weapon ray. Carries the
 * switch id so SecretWall components can advance their lift state
 * (multi-listener: SFX + scene + future minimap pings).
 */
export interface SecretTriggeredEvent {
	type: "secretTriggered";
	id: number;
	x: number;
	y: number;
}

export type ObjexoomEvent =
	| BurstEvent
	| BodyPartsEvent
	| ShellEjectEvent
	| FireEvent
	| JumpEvent
	| LookEvent
	| MoveEvent
	| DebugKillAllEvent
	| DebugCollectPickupsEvent
	| PlayerHitEvent
	| FpsUpdateEvent
	| ShakeEvent
	| FellToDeathEvent
	| TeleportEvent
	| SecretTriggeredEvent
	| DamageNumberEvent;

export type ObjexoomEventType = ObjexoomEvent["type"];

/** Resolves an event-type literal to its full payload shape. */
export type EventOf<K extends ObjexoomEventType> = Extract<ObjexoomEvent, { type: K }>;

/** The `detail` shape that travels on a CustomEvent (everything except `type`). */
type DetailOf<E extends ObjexoomEvent> = Omit<E, "type">;

/**
 * Dispatch a typed Objexoom event. Wraps the existing
 * `window.dispatchEvent(new CustomEvent(...))` pattern so the migration
 * is a pure call-site swap.
 *
 * The runtime payload on the CustomEvent is the same shape ARCH1b's
 * consumers see today (`event.detail.x`, `event.detail.kind`, etc) —
 * `type` is encoded in the event name, not duplicated in the detail.
 */
export function dispatch<E extends ObjexoomEvent>(event: E): void {
	const { type, ...detail } = event;
	const eventName = `objexoom:${type}`;
	const customEvent = new CustomEvent(eventName, { detail });
	window.dispatchEvent(customEvent);
}

/**
 * Add a typed listener for one Objexoom event channel. The handler
 * receives the full event (type + detail merged) so the union narrows
 * naturally inside the body.
 *
 * Returns a teardown function so consumers can clean up without
 * tracking the bound handler manually:
 *
 *   useEffect(() => addObjexoomListener("burst", (e) => {
 *     // e is BurstEvent — e.kind narrows to BurstKind, etc.
 *   }), []);
 */
export function addObjexoomListener<K extends ObjexoomEventType>(
	type: K,
	handler: (event: EventOf<K>) => void,
): () => void {
	const eventName = `objexoom:${type}`;
	const adapter = (e: Event) => {
		const detail = (e as CustomEvent<DetailOf<EventOf<K>>>).detail;
		// Reconstruct the full discriminated-union member from the wire detail.
		handler({ type, ...detail } as EventOf<K>);
	};
	window.addEventListener(eventName, adapter);
	return () => window.removeEventListener(eventName, adapter);
}
