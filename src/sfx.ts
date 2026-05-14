import * as Tone from "tone";

let initialized = false;
let pistolSynth: Tone.MembraneSynth | null = null;
let chaingunSynth: Tone.MetalSynth | null = null;
let shotgunSynth: Tone.NoiseSynth | null = null;
// E1 — short whoosh + click for the melee swing.
let meleeSynth: Tone.NoiseSynth | null = null;
let hurtSynth: Tone.Synth | null = null;
let deathSynth: Tone.PluckSynth | null = null;
let pickupSynth: Tone.Synth | null = null;
let doorSynth: Tone.MembraneSynth | null = null;
let portalSynth: Tone.FMSynth | null = null;
let ambientDrone: Tone.AMSynth | null = null;
let masterReverb: Tone.Reverb | null = null;
// K5 — procedural music. 6 voices scheduled through Tone.Transport.
// Each voice steps through its melody on every beat; tempo + active
// mood drive the rhythmic intensity.
export type MusicMood = "exploration" | "combat" | "going_back";
// K5/K6 — music state grouped into a single mutable record so the const
// binding never gets reassigned; only the fields change as init / loop /
// mood-switch helpers run.
const music = {
	synths: [] as Tone.PolySynth[],
	loop: null as Tone.Loop | null,
	mood: "exploration" as MusicMood,
	step: 0,
	tracksLoaded: 0,
};
const MUSIC_TRACK_COUNT = 6;
// I7 — aggro alert (deep growl) panned to the enemy's position.
let aggroSynth: Tone.MonoSynth | null = null;
let aggroPanner: Tone.Panner | null = null;
// K1 — explosion stinger for enemy-death + going_back start.
let boomSynth: Tone.MembraneSynth | null = null;
let boomNoise: Tone.NoiseSynth | null = null;
// K2 — player-hit sting (sharper than the ambient playHurt).
let hitStingSynth: Tone.Synth | null = null;
// K7 — door-open clock SFX (mechanical tick + low boom).
let doorTickSynth: Tone.MetalSynth | null = null;

export async function ensureSfx() {
	if (initialized) return;
	initialized = true;
	if (Tone.getContext().state !== "running") {
		try {
			await Tone.start();
		} catch {
			// fall through — sounds will be silent
		}
	}
	masterReverb = new Tone.Reverb({ decay: 1.4, wet: 0.18 }).toDestination();

	pistolSynth = new Tone.MembraneSynth({
		pitchDecay: 0.04,
		octaves: 6,
		oscillator: { type: "square" },
		envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
		volume: -8,
	}).connect(masterReverb);

	chaingunSynth = new Tone.MetalSynth({
		envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
		harmonicity: 5.1,
		modulationIndex: 18,
		resonance: 1500,
		octaves: 1,
		volume: -16,
	}).connect(masterReverb);

	shotgunSynth = new Tone.NoiseSynth({
		noise: { type: "brown" },
		envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.08 },
		volume: -6,
	}).connect(masterReverb);

	meleeSynth = new Tone.NoiseSynth({
		// White-noise whoosh tail. Faster attack than the shotgun + far
		// shorter decay so it reads as a swing, not a blast.
		noise: { type: "white" },
		envelope: { attack: 0.01, decay: 0.08, sustain: 0, release: 0.04 },
		volume: -14,
	}).connect(masterReverb);

	hurtSynth = new Tone.Synth({
		oscillator: { type: "sawtooth" },
		envelope: { attack: 0.005, decay: 0.12, sustain: 0, release: 0.06 },
		volume: -10,
	}).connect(masterReverb);

	deathSynth = new Tone.PluckSynth({
		attackNoise: 1.5,
		dampening: 1500,
		resonance: 0.85,
		volume: -8,
	}).connect(masterReverb);

	pickupSynth = new Tone.Synth({
		oscillator: { type: "triangle" },
		envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.1 },
		volume: -8,
	}).connect(masterReverb);

	doorSynth = new Tone.MembraneSynth({
		pitchDecay: 0.5,
		octaves: 2,
		oscillator: { type: "sine" },
		envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.4 },
		volume: -12,
	}).connect(masterReverb);

	portalSynth = new Tone.FMSynth({
		harmonicity: 0.5,
		modulationIndex: 6,
		oscillator: { type: "sine" },
		envelope: { attack: 0.4, decay: 0.6, sustain: 0.4, release: 1.5 },
		modulation: { type: "sine" },
		modulationEnvelope: { attack: 0.6, decay: 0.4, sustain: 0.6, release: 1 },
		volume: -16,
	}).connect(masterReverb);

	ambientDrone = new Tone.AMSynth({
		oscillator: { type: "sine" },
		modulation: { type: "sawtooth" },
		harmonicity: 0.3,
		envelope: { attack: 1.5, decay: 0.5, sustain: 0.5, release: 2 },
		modulationEnvelope: { attack: 1, decay: 0.5, sustain: 0.6, release: 2 },
		volume: -32,
	}).connect(masterReverb);

	// I7 — aggro alert: deep growl that fires the first time an enemy
	// transitions patrol → chase. Routed through a Tone.Panner so we can
	// place the sound horizontally relative to the player's facing.
	aggroPanner = new Tone.Panner(0).connect(masterReverb);
	aggroSynth = new Tone.MonoSynth({
		oscillator: { type: "sawtooth" },
		filter: { Q: 4, type: "lowpass", rolloff: -24 },
		envelope: { attack: 0.04, decay: 0.18, sustain: 0, release: 0.2 },
		filterEnvelope: {
			attack: 0.02,
			decay: 0.15,
			sustain: 0.2,
			release: 0.2,
			baseFrequency: 80,
			octaves: 2,
		},
		volume: -14,
	}).connect(aggroPanner);

	// K1 — explosion stinger. Punchy low membrane + filtered noise burst.
	boomSynth = new Tone.MembraneSynth({
		pitchDecay: 0.12,
		octaves: 8,
		oscillator: { type: "sine" },
		envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
		volume: -4,
	}).connect(masterReverb);
	boomNoise = new Tone.NoiseSynth({
		noise: { type: "brown" },
		envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.15 },
		volume: -10,
	}).connect(masterReverb);

	// K2 — player-hit sting. Short detuned bite, distinct from playHurt.
	hitStingSynth = new Tone.Synth({
		oscillator: { type: "square" },
		envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 },
		volume: -8,
	}).connect(masterReverb);

	// K7 — door-open clock SFX. MetalSynth for the mechanical tick.
	doorTickSynth = new Tone.MetalSynth({
		envelope: { attack: 0.002, decay: 0.4, release: 0.2 },
		harmonicity: 3.1,
		modulationIndex: 12,
		resonance: 800,
		octaves: 0.5,
		volume: -14,
	}).connect(masterReverb);

	// K5/K6 — six music voices, each a PolySynth with a distinct timbre.
	// They share the master reverb and the Tone.Transport clock. Building
	// them one at a time lets K6 surface a `tracksLoaded` count for the
	// landing loading indicator.
	music.synths = [];
	music.tracksLoaded = 0;
	for (let v = 0; v < MUSIC_TRACK_COUNT; v += 1) {
		const synth = new Tone.PolySynth(Tone.Synth, {
			oscillator: {
				type: v < 2 ? "triangle" : v < 4 ? "sine" : "sawtooth",
			},
			envelope: {
				attack: 0.04 + v * 0.01,
				decay: 0.18,
				sustain: 0.2,
				release: 0.3,
			},
			volume: -28 - v * 1.5,
		}).connect(masterReverb);
		music.synths.push(synth);
		music.tracksLoaded += 1;
	}
}

/**
 * POL8 — per-voice last-fire-time tracking to avoid Tone.js
 * "Start time must be strictly greater than previous start time".
 *
 * Two consecutive `triggerAttackRelease` calls within the same audio
 * frame produce identical `Tone.now()` values, and Tone refuses to
 * schedule the second one. The fix: track the last-scheduled time per
 * voice and bump forward by 1ms whenever we'd otherwise collide.
 * The 1ms jitter is below human perception of timing.
 *
 * Voices that are gated by a per-weapon cooldown (pistol, shotgun,
 * melee, flamethrower, hurt) can't collide because the cooldown is
 * always > 1 audio frame; only chaingun (90ms cooldown which can fire
 * twice per frame at 11/sec sustained), aggro alerts (N enemies aggro
 * in one frame), skeleton deaths (chain-reactions), and pickup (paired
 * E5+A5 fires) need this protection.
 */
function jitter(prevTime: number): number {
	const now = Tone.now();
	return Math.max(now, prevTime + 0.001);
}

export function playPistol() {
	pistolSynth?.triggerAttackRelease("C2", "32n");
}

let lastChaingunFireTime = 0;
export function playChaingun() {
	const t = jitter(lastChaingunFireTime);
	lastChaingunFireTime = t;
	chaingunSynth?.triggerAttackRelease("16n", t, 0.6);
}

export function playShotgun() {
	shotgunSynth?.triggerAttackRelease("8n");
}

export function playMelee() {
	meleeSynth?.triggerAttackRelease("16n");
}

/**
 * E8 — flamethrower whoosh. Reuses the shotgun NoiseSynth (brown
 * noise with a short envelope) at a tighter duration so per-tick
 * fires at 100ms cooldown overlap into a continuous hiss rather than
 * discrete shotgun blasts.
 */
let lastFlamethrowerFireTime = 0;
export function playFlamethrower() {
	// 100ms cooldown can also occasionally land twice per frame.
	const t = jitter(lastFlamethrowerFireTime);
	lastFlamethrowerFireTime = t;
	shotgunSynth?.triggerAttackRelease("32n", t);
}

let lastHurtFireTime = 0;
export function playHurt() {
	// Multiple enemies hitting in one frame → multiple playHurt calls.
	const t = jitter(lastHurtFireTime);
	lastHurtFireTime = t;
	hurtSynth?.triggerAttackRelease("E2", "16n", t);
}

let lastDeathFireTime = 0;
export function playSkeletonDeath() {
	const t = jitter(lastDeathFireTime);
	lastDeathFireTime = t;
	deathSynth?.triggerAttackRelease("A1", t);
	setTimeout(() => {
		const inner = jitter(lastDeathFireTime);
		lastDeathFireTime = inner;
		deathSynth?.triggerAttackRelease("D1", inner);
	}, 80);
}

/**
 * POL9-v2 — modernized-DOOM player-death sting. Layered cue:
 *
 *   1. Sub-bass thud — boomSynth hits A0 (deeper than the boss thud
 *      so the player reads "I'm down", not "I won"). boomNoise
 *      layered for body.
 *   2. Descending tonal sequence — deathSynth E3 → B2 → E2 → A1 over
 *      800ms (4-note descent, wider interval than the boss resolve).
 *      Reads as life draining.
 *   3. Reverb tail — masterReverb wet briefly pushed to 0.5 for 1.2s
 *      then ramped back, so the descent rings out cathedral-large.
 *
 * The pre-v2 implementation was three isolated PluckSynth notes. The
 * v2 layered version reads as the same caliber of death cue as DOOM
 * Eternal's "you died" beat.
 */
let lastPlayerDeathFireTime = 0;
let lastBoomFireTime = 0;
let lastBoomNoiseFireTime = 0;
let lastAmbientDroneFireTime = 0;
export function playPlayerDeath() {
	const t = jitter(lastPlayerDeathFireTime);
	lastPlayerDeathFireTime = t;
	// Layer 1 — sub-bass thud + noise body. Per-voice jitter — both
	// boom synths can be retriggered by playBossDeath or playBoom on
	// the same audio frame.
	const tBoom = jitter(lastBoomFireTime);
	lastBoomFireTime = tBoom;
	boomSynth?.triggerAttackRelease("A0", "2n", tBoom, 0.85);
	const tNoise = jitter(lastBoomNoiseFireTime);
	lastBoomNoiseFireTime = tNoise;
	boomNoise?.triggerAttackRelease("4n", tNoise, 0.65);
	// Layer 2 — descending 4-note tonal sequence.
	deathSynth?.triggerAttackRelease("E3", t);
	setTimeout(() => deathSynth?.triggerAttackRelease("B2", jitter(lastPlayerDeathFireTime)), 180);
	setTimeout(() => deathSynth?.triggerAttackRelease("E2", jitter(lastPlayerDeathFireTime)), 420);
	setTimeout(() => deathSynth?.triggerAttackRelease("A1", jitter(lastPlayerDeathFireTime)), 680);
	// Layer 3 — push reverb wet briefly so the tail rings cathedral-
	// large. Manual ramp back to default 0.18 over 1.2s.
	if (masterReverb) {
		masterReverb.wet.rampTo(0.5, 0.1);
		setTimeout(() => {
			masterReverb?.wet.rampTo(0.18, 1.0);
		}, 1200);
	}
}

/**
 * POL10-v2 — modernized-DOOM boss-down sting. Layered cue, not a
 * single sequence:
 *
 *   1. Sub-bass THUD — boomSynth (low MembraneSynth) hits C1, the
 *      "weight" of the kill. boomNoise layered for body.
 *   2. 4-note ascending tonal RESOLVE — deathSynth G1 → D2 → G2 → D3
 *      over 480ms with decay overlap. Reads as a triumph cadence.
 *   3. Ambient swell — ambientDrone retriggered at C2 for 1.4s with
 *      a brief volume push so the air carries the resolve tail.
 *
 * Player who took down a boss reads: "weight + resolution + lingering
 * room tone." Not three isolated notes.
 */
let lastBossDeathFireTime = 0;
export function playBossDeath() {
	const t = jitter(lastBossDeathFireTime);
	lastBossDeathFireTime = t;
	// Layer 1 — sub-bass thud (the weight). Pitched lower than the
	// standard boom so it doesn't read as a barrel explosion. Per-
	// voice jitter — boom synths can collide with playPlayerDeath /
	// playBoom on the same frame.
	const tBoom = jitter(lastBoomFireTime);
	lastBoomFireTime = tBoom;
	boomSynth?.triggerAttackRelease("C1", "4n", tBoom, 0.9);
	const tNoise = jitter(lastBoomNoiseFireTime);
	lastBoomNoiseFireTime = tNoise;
	boomNoise?.triggerAttackRelease("8n", tNoise, 0.55);
	// Layer 2 — 4-note ascending tonal resolve with decay overlap.
	deathSynth?.triggerAttackRelease("G1", t);
	setTimeout(() => deathSynth?.triggerAttackRelease("D2", jitter(lastBossDeathFireTime)), 120);
	setTimeout(() => deathSynth?.triggerAttackRelease("G2", jitter(lastBossDeathFireTime)), 280);
	setTimeout(() => deathSynth?.triggerAttackRelease("D3", jitter(lastBossDeathFireTime)), 480);
	// Layer 3 — ambient swell. Retrigger the existing drone at a
	// higher pitch so it audibly lifts under the resolve. Per-voice
	// jitter — multiple boss kills inside 1.4s could collide.
	setTimeout(() => {
		const tDrone = jitter(lastAmbientDroneFireTime);
		lastAmbientDroneFireTime = tDrone;
		ambientDrone?.triggerAttackRelease("C2", "1n", tDrone);
	}, 240);
}

let lastPickupFireTime = 0;
export function playPickup() {
	const t = jitter(lastPickupFireTime);
	lastPickupFireTime = t;
	pickupSynth?.triggerAttackRelease("E5", "16n", t);
	setTimeout(() => {
		const inner = jitter(lastPickupFireTime);
		lastPickupFireTime = inner;
		pickupSynth?.triggerAttackRelease("A5", "16n", inner);
	}, 90);
}

/**
 * POL21 — secret-found ceremony sting. Brighter than playPickup:
 * 4-note ascending chime (E5 → A5 → C#6 → E6) on the pickup synth +
 * a brief reverb push so the discovery resolves cathedral-wide.
 * Distinct from any other sting in the sfx bank.
 */
/**
 * POL26 — going-back klaxon. Two-tone alarm (A4 → E4 → A4 → E4) over
 * 800ms on the hurtSynth (sawtooth, sharper than the pickup
 * triangle). Fires once when the player crosses the goal portal +
 * the phase flips to going_back. Distinct sting from boss-death,
 * skeleton-death, secret-found — pure descending warning tone.
 */
let lastKlaxonFireTime = 0;
export function playKlaxon() {
	const t = jitter(lastKlaxonFireTime);
	lastKlaxonFireTime = t;
	hurtSynth?.triggerAttackRelease("A4", "8n", t);
	setTimeout(() => {
		const inner = jitter(lastKlaxonFireTime);
		lastKlaxonFireTime = inner;
		hurtSynth?.triggerAttackRelease("E4", "8n", inner);
	}, 220);
	setTimeout(() => {
		const inner = jitter(lastKlaxonFireTime);
		lastKlaxonFireTime = inner;
		hurtSynth?.triggerAttackRelease("A4", "8n", inner);
	}, 440);
	setTimeout(() => {
		const inner = jitter(lastKlaxonFireTime);
		lastKlaxonFireTime = inner;
		hurtSynth?.triggerAttackRelease("E4", "4n", inner);
	}, 660);
}

/**
 * POL28 — flashlight click-on sting. Short metallic tick on the door-
 * tick MetalSynth (already a sharp transient, perfect for "click").
 * Fires once on flashlight pickup. Separate channel from playDoorTick
 * via the jitter pool so a near-simultaneous door event doesn't
 * collide.
 */
let lastFlashlightClickFireTime = 0;
export function playFlashlightClick() {
	const t = jitter(lastFlashlightClickFireTime);
	lastFlashlightClickFireTime = t;
	doorTickSynth?.triggerAttackRelease("16n", t, 0.6);
}

export function playSecretFound() {
	// Share the pickupSynth pool with playPickup — both fire jittered
	// through lastPickupFireTime to prevent same-frame collisions.
	const t = jitter(lastPickupFireTime);
	lastPickupFireTime = t;
	pickupSynth?.triggerAttackRelease("E5", "16n", t);
	setTimeout(() => {
		const inner = jitter(lastPickupFireTime);
		lastPickupFireTime = inner;
		pickupSynth?.triggerAttackRelease("A5", "16n", inner);
	}, 90);
	setTimeout(() => {
		const inner = jitter(lastPickupFireTime);
		lastPickupFireTime = inner;
		pickupSynth?.triggerAttackRelease("C#6", "16n", inner);
	}, 180);
	setTimeout(() => {
		const inner = jitter(lastPickupFireTime);
		lastPickupFireTime = inner;
		pickupSynth?.triggerAttackRelease("E6", "8n", inner);
	}, 270);
	// Reverb push so the discovery rings out.
	if (masterReverb) {
		masterReverb.wet.rampTo(0.4, 0.05);
		setTimeout(() => {
			masterReverb?.wet.rampTo(0.18, 0.6);
		}, 600);
	}
}

export function playDoor() {
	doorSynth?.triggerAttackRelease("C3", "2n");
}

export function playPortal() {
	portalSynth?.triggerAttackRelease("G3", "1n");
}

export function startAmbient() {
	ambientDrone?.triggerAttack("C1");
}

export function stopAmbient() {
	ambientDrone?.triggerRelease();
}

// E11 — per-archetype ambient bed. Each archetype shifts the drone's
// pitch + volume so corridor/arena/courtyard/sewer/library each have
// a distinct ambient character. `setAmbientArchetype` is idempotent.
// Phase-reactive volume: when the player flips into `going_back`,
// `setAmbientPhase("going_back")` swells the drone +6dB so the
// "everything aggros, sprint back" beat reads sonically too.
export type AmbientArchetype = "corridor" | "arena" | "courtyard" | "sewer" | "library";

const ARCHETYPE_AMBIENT: Record<AmbientArchetype, { pitch: string; volumeDb: number }> = {
	corridor: { pitch: "C1", volumeDb: -32 },
	arena: { pitch: "G1", volumeDb: -30 }, // brighter, slightly louder
	courtyard: { pitch: "D1", volumeDb: -34 }, // open-air, quieter
	sewer: { pitch: "A0", volumeDb: -28 }, // sub-bass, oppressive
	library: { pitch: "E1", volumeDb: -36 }, // delicate, near-silent
};

let currentArchetype: AmbientArchetype = "corridor";
let currentPhase: "out" | "going_back" = "out";

function applyAmbientGain() {
	if (!ambientDrone) return;
	const base = ARCHETYPE_AMBIENT[currentArchetype].volumeDb;
	const phaseBoost = currentPhase === "going_back" ? 6 : 0;
	ambientDrone.volume.rampTo(base + phaseBoost, 0.8);
}

export function setAmbientArchetype(archetype: AmbientArchetype) {
	if (archetype === currentArchetype) return;
	currentArchetype = archetype;
	if (!ambientDrone) return;
	const target = ARCHETYPE_AMBIENT[archetype];
	// Re-trigger at the new pitch so the drone shifts character.
	ambientDrone.triggerRelease();
	ambientDrone.triggerAttack(target.pitch);
	applyAmbientGain();
}

export function setAmbientPhase(phase: "out" | "going_back") {
	if (phase === currentPhase) return;
	currentPhase = phase;
	applyAmbientGain();
}

/** Test-only: snapshot the current ambient state without touching audio. */
export function getAmbientStateForTesting(): {
	archetype: AmbientArchetype;
	phase: "out" | "going_back";
	resolvedPitch: string;
	resolvedVolumeDb: number;
} {
	const base = ARCHETYPE_AMBIENT[currentArchetype].volumeDb;
	const phaseBoost = currentPhase === "going_back" ? 6 : 0;
	return {
		archetype: currentArchetype,
		phase: currentPhase,
		resolvedPitch: ARCHETYPE_AMBIENT[currentArchetype].pitch,
		resolvedVolumeDb: base + phaseBoost,
	};
}

/** Test-only: reset to defaults so tests don't bleed state. */
export function resetAmbientStateForTesting() {
	currentArchetype = "corridor";
	currentPhase = "out";
}

// K1 — explosion stinger. Membrane sub-boom + brown-noise transient.
// POL21 fold-forward: jittered so it doesn't collide with the death
// stings (POL9-v2 / POL10-v2) when an enemy dies + a barrel pops in
// the same tick.
export function playBoom() {
	const tBoom = jitter(lastBoomFireTime);
	lastBoomFireTime = tBoom;
	boomSynth?.triggerAttackRelease("C1", "8n", tBoom);
	const tNoise = jitter(lastBoomNoiseFireTime);
	lastBoomNoiseFireTime = tNoise;
	boomNoise?.triggerAttackRelease("16n", tNoise);
}

// K2 — player-hit sting. Sharp detuned bite; pairs with playHurt for
// the sustained "ouch" tail.
export function playHitSting() {
	hitStingSynth?.triggerAttackRelease("G#3", "32n");
}

// K7 — door-open clock SFX. Mechanical tick on RealDoor/LockedDoor
// open. Pairs naturally with playDoor (the heavy membrane).
export function playDoorTick() {
	doorTickSynth?.triggerAttackRelease("32n", Tone.now(), 0.6);
}

/**
 * I7 — directional aggro growl. `pan` is in [-1, 1] (left to right) and
 * follows the reference's formula
 *   pan = cos(angle_between_enemy_and_camera + theta + π/2)
 * which the caller computes from enemy position + camera yaw. Pitch
 * is randomized slightly so a swarm doesn't unison-roar.
 */
let lastAggroFireTime = 0;
export function playAggroAlert(pan: number) {
	if (!aggroSynth || !aggroPanner) return;
	const clamped = Math.max(-1, Math.min(1, pan));
	aggroPanner.pan.rampTo(clamped, 0.02);
	const notes = ["A1", "G1", "F1", "E1"] as const;
	const note = notes[(Math.random() * notes.length) | 0];
	const t = jitter(lastAggroFireTime);
	lastAggroFireTime = t;
	aggroSynth.triggerAttackRelease(note, "8n", t);
}

/**
 * I7 — turn an enemy world position + camera yaw into a stereo pan
 * value in [-1, 1]. The game uses three.js with rotation.y for yaw,
 * which makes the camera-forward vector in XZ space `(-sin(yaw),
 * -cos(yaw))`. An enemy directly ahead of the camera pans centered
 * (0); right of camera pans positive, left negative.
 *
 *   relative = atan2(dy, dx) - atan2(-cos(yaw), -sin(yaw))
 *   pan      = sin(relative)
 */
export function panForPosition(
	enemy: { x: number; y: number },
	camera: { x: number; y: number; yaw: number },
): number {
	const enemyAngle = Math.atan2(enemy.y - camera.y, enemy.x - camera.x);
	const forwardAngle = Math.atan2(-Math.cos(camera.yaw), -Math.sin(camera.yaw));
	return Math.sin(enemyAngle - forwardAngle);
}

// K5 — three preset mood melodies. Each row is one voice's note loop;
// nulls are rests. Voice 0 = bass, 1 = pad, 2-5 = arps.
const MOOD_MELODIES: Record<MusicMood, ReadonlyArray<ReadonlyArray<string | null>>> = {
	exploration: [
		["A1", null, null, "E2", null, null, "A1", null],
		["E4", null, "A4", null, "B4", null, "E4", null],
		[null, "C5", null, "E5", null, "A5", null, "G5"],
		["A2", null, null, null, "B2", null, null, null],
		[null, null, "G4", null, null, "E5", null, null],
		[null, null, null, null, null, null, null, "C6"],
	],
	combat: [
		["A1", "A1", "G1", "G1", "F1", "F1", "E1", "E1"],
		["E3", "G3", "A3", "G3", "E3", "G3", "A3", "B3"],
		["C5", "E5", "G5", "E5", "C5", "E5", "G5", "A5"],
		["A2", "C3", "E3", "G3", "A2", "C3", "E3", "G3"],
		["E4", null, "G4", null, "E4", null, "G4", "A4"],
		["A5", null, null, "G5", null, null, "E5", null],
	],
	going_back: [
		["A1", "A1", "A1", "A1", "F1", "F1", "F1", "F1"],
		["C2", "C2", "C2", "C2", "D2", "D2", "D2", "D2"],
		["E5", "F5", "G5", "F5", "E5", "F5", "G5", "F5"],
		["C6", null, "B5", null, "A5", null, "G5", null],
		["A3", "C4", "E4", "G4", "A3", "C4", "E4", "G4"],
		["E5", null, null, null, "C5", null, null, null],
	],
};

/**
 * K5 — start the procedural music engine. Schedules `music.loop` against
 * Tone.Transport so each beat advances the step pointer and triggers
 * one note per voice from the active mood's melody array.
 */
export function startMusic() {
	if (music.synths.length === 0) return;
	if (music.loop) return;
	Tone.getTransport().bpm.value = 96;
	music.step = 0;
	music.loop = new Tone.Loop((time) => {
		const melodies = MOOD_MELODIES[music.mood];
		for (let v = 0; v < melodies.length && v < music.synths.length; v += 1) {
			const note = melodies[v][music.step % melodies[v].length];
			if (note) music.synths[v].triggerAttackRelease(note, "8n", time);
		}
		music.step += 1;
	}, "8n").start(0);
	Tone.getTransport().start();
}

export function stopMusic() {
	music.loop?.stop();
	music.loop?.dispose();
	music.loop = null;
	Tone.getTransport().stop();
}

export function setMusicMood(mood: MusicMood) {
	music.mood = mood;
}

// K6 — returns (loaded, total) so the landing can render the same
// "(N/6) loaded" pattern as the reference's track scaffold.
export function getMusicLoadProgress(): { loaded: number; total: number } {
	return { loaded: music.tracksLoaded, total: MUSIC_TRACK_COUNT };
}
