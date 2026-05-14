"use client";

import * as Tone from "tone";

let initialized = false;
let pistolSynth: Tone.MembraneSynth | null = null;
let chaingunSynth: Tone.MetalSynth | null = null;
let shotgunSynth: Tone.NoiseSynth | null = null;
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

export function playPistol() {
	pistolSynth?.triggerAttackRelease("C2", "32n");
}

export function playChaingun() {
	chaingunSynth?.triggerAttackRelease("16n", Tone.now(), 0.6);
}

export function playShotgun() {
	shotgunSynth?.triggerAttackRelease("8n");
}

export function playHurt() {
	hurtSynth?.triggerAttackRelease("E2", "16n");
}

export function playSkeletonDeath() {
	deathSynth?.triggerAttackRelease("A1", Tone.now());
	setTimeout(() => deathSynth?.triggerAttackRelease("D1", Tone.now()), 80);
}

export function playPickup() {
	pickupSynth?.triggerAttackRelease("E5", "16n");
	setTimeout(() => pickupSynth?.triggerAttackRelease("A5", "16n"), 90);
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

// K1 — explosion stinger. Membrane sub-boom + brown-noise transient.
export function playBoom() {
	boomSynth?.triggerAttackRelease("C1", "8n");
	boomNoise?.triggerAttackRelease("16n");
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
export function playAggroAlert(pan: number) {
	if (!aggroSynth || !aggroPanner) return;
	const clamped = Math.max(-1, Math.min(1, pan));
	aggroPanner.pan.rampTo(clamped, 0.02);
	const notes = ["A1", "G1", "F1", "E1"] as const;
	const note = notes[(Math.random() * notes.length) | 0];
	aggroSynth.triggerAttackRelease(note, "8n");
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
