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
 *   - debug-hook surface — gated by ?bonebusterDebug; one-to-many is fine
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
export type BurstKind = "damage" | "pickup" | "playerHit" | "explode" | "flameStream";

export interface BurstEvent {
	type: "burst";
	x: number;
	y: number;
	kind: BurstKind;
	/**
	 * E8 step-2 — optional unit direction vector (x,z in world plane). Used
	 * only by `flameStream` today to orient the cone away from the
	 * camera/muzzle. Other burst kinds ignore it.
	 */
	dirX?: number;
	dirY?: number;
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

/**
 * PT3A — boss-only debug kill so playtest can capture the boss-tier
 * death moment in isolation (POL12 150ms hitstop, POL10-v2 sting,
 * POL16 burst, POL25 body-parts) without the chaos of 8 simultaneous
 * regular-tier kills firing the same dispatch chain.
 */
export interface DebugKillBossEvent {
	type: "debugKillBoss";
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
	/** OBS1 — gl.info.render.calls (draw calls per frame, latest sample). */
	drawCalls?: number;
	/** OBS1 — gl.info.render.triangles (triangle count per frame, latest sample). */
	triangles?: number;
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

/**
 * POL22 — fires when the player picks up the key. Consumed by the
 * KeyPickupCeremony HUD overlay slot.
 */
export interface KeyPickedUpEvent {
	type: "keyPickedUp";
}

/**
 * POL28 — fires when the player picks up the flashlight. Used for
 * the click-on audio sting + future brighten effects.
 */
export interface FlashlightAcquiredEvent {
	type: "flashlightAcquired";
}

/**
 * POL30 — fires when any pickup is collected (except keys, which
 * have their own POL22 ceremony). The HUD's PickupChip slot listens
 * for this and renders a 600ms transient chip with per-kind label
 * and palette so the moment reads as a discrete teach beat instead
 * of "the pickup mesh just disappeared."
 *
 * Kind is the PickupKind discriminant (re-exported here as a string
 * to avoid a circular import from engine.ts; the receiver narrows).
 */
export interface PickupCollectedEvent {
	type: "pickupCollected";
	kind: string;
}

/**
 * D3 — fires the first time the player picks up a weapon (the
 * underlying ownedWeapons[X] flips false→true). The PickupChip
 * HUD slot listens for this and renders a 600ms chip-brighten
 * beat in the weapon's accent palette so the moment reads as a
 * discrete teach beat. Idempotent per weapon — a second pickup
 * of the same weapon's ammo does NOT re-dispatch, so the chip
 * fires exactly once per weapon per session.
 *
 * Carries the WeaponId as a string discriminant (the receiver
 * can narrow against WEAPON_ORDER from shared/weapons.ts);
 * imports the WeaponId type would re-introduce a circular
 * import from engine.ts that the rest of this module already
 * avoids.
 */
export interface WeaponAcquiredEvent {
	type: "weaponAcquired";
	weapon: "melee" | "pistol" | "chaingun" | "shotgun" | "flamethrower";
}

/**
 * POL36 — fires the first time the player camera has line-of-sight
 * to any tier="boss" enemy on the current map. The BossBanner HUD
 * slot listens for this and renders a one-shot "⚠ BOSS APPROACHES"
 * stencil card. One dispatch per map (the player tick loop guards
 * via a Set<enemyId>).
 */
export interface BossSpottedEvent {
	type: "bossSpotted";
	enemyId: number;
}

/**
 * POL36 — fires when a tier="boss" enemy dies. The BossBanner HUD
 * slot renders a "✦ BOSS DEFEATED" celebratory card. POL10-v2's
 * existing boss-death audio sting carries the audio half; this
 * event just gates the HUD card.
 */
export interface BossDefeatedEvent {
	type: "bossDefeated";
	enemyId: number;
}

/**
 * PB2 — non-boss kill notification. Fires once per enemy whose HP
 * crosses ≤0, carrying the kind so the HUD's KillBanner can render
 * "BUSTED A <KIND>" with a brief overlay. Boss kills keep their own
 * dedicated `bossDefeated` event + banner; this stays separate so
 * a "BUSTED A BIGHOSS" banner doesn't collide with "✦ BOSS DEFEATED".
 */
export interface EnemyKilledEvent {
	type: "enemyKilled";
	enemyId: number;
	kind: string;
}

/**
 * PB5 step-2 — EMF reading broadcast. Dispatched from the Scene's
 * per-frame tick (throttled to ~10Hz so HUD re-renders stay cheap)
 * with the current 0-5 EMF level. The HUD's EmfChip slot listens
 * for this and renders a stepwise color-coded bar. Only dispatched
 * while the player owns the EMF reader; un-owned = no events = HUD
 * chip stays hidden.
 */
export interface EmfReadingEvent {
	type: "emfReading";
	level: 0 | 1 | 2 | 3 | 4 | 5;
}

/**
 * PC2 — spirit-box response. Dispatched from the Scene tick when
 * (a) the player owns the spirit box, (b) a live enemy is within
 * SPIRIT_BOX_TRIGGER_RADIUS tiles, and (c) the per-tick cooldown
 * has expired. Carries the phoneme string (`pickSpiritBoxPhoneme`
 * result) so the SpiritBoxBubble HUD slot just renders the
 * payload — no Scene → HUD coupling beyond this event shape.
 */
export interface SpiritBoxResponseEvent {
	type: "spiritBoxResponse";
	phoneme: string;
}

/**
 * PC4 — Player pressed `9` to place a crucifix. Scene listens for
 * this, decrements `state.crucifixes`, and pushes a new
 * CrucifixInstance into the active list. Key-input layer dispatches;
 * the gameplay state owner consumes.
 */
export interface CrucifixPlaceEvent {
	type: "crucifixPlace";
}

export type BoneBusterEvent =
	| BurstEvent
	| BodyPartsEvent
	| ShellEjectEvent
	| FireEvent
	| JumpEvent
	| LookEvent
	| MoveEvent
	| DebugKillAllEvent
	| DebugKillBossEvent
	| DebugCollectPickupsEvent
	| PlayerHitEvent
	| FpsUpdateEvent
	| ShakeEvent
	| FellToDeathEvent
	| TeleportEvent
	| SecretTriggeredEvent
	| DamageNumberEvent
	| KeyPickedUpEvent
	| FlashlightAcquiredEvent
	| PickupCollectedEvent
	| WeaponAcquiredEvent
	| BossSpottedEvent
	| BossDefeatedEvent
	| EnemyKilledEvent
	| EmfReadingEvent
	| SpiritBoxResponseEvent
	| CrucifixPlaceEvent;

export type BoneBusterEventType = BoneBusterEvent["type"];

/** Resolves an event-type literal to its full payload shape. */
export type EventOf<K extends BoneBusterEventType> = Extract<BoneBusterEvent, { type: K }>;

/** The `detail` shape that travels on a CustomEvent (everything except `type`). */
type DetailOf<E extends BoneBusterEvent> = Omit<E, "type">;

/**
 * Dispatch a typed Bone Buster event. Wraps the existing
 * `window.dispatchEvent(new CustomEvent(...))` pattern so the migration
 * is a pure call-site swap.
 *
 * The runtime payload on the CustomEvent is the same shape ARCH1b's
 * consumers see today (`event.detail.x`, `event.detail.kind`, etc) —
 * `type` is encoded in the event name, not duplicated in the detail.
 */
export function dispatch<E extends BoneBusterEvent>(event: E): void {
	const { type, ...detail } = event;
	const eventName = `objexoom:${type}`;
	const customEvent = new CustomEvent(eventName, { detail });
	window.dispatchEvent(customEvent);
}

/**
 * Add a typed listener for one Bone Buster event channel. The handler
 * receives the full event (type + detail merged) so the union narrows
 * naturally inside the body.
 *
 * Returns a teardown function so consumers can clean up without
 * tracking the bound handler manually:
 *
 *   useEffect(() => addBoneBusterListener("burst", (e) => {
 *     // e is BurstEvent — e.kind narrows to BurstKind, etc.
 *   }), []);
 */
export function addBoneBusterListener<K extends BoneBusterEventType>(
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
