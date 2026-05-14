import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { SCALE } from "../../design-tokens";
import { addObjexoomListener, type EventOf } from "../../events";

/**
 * POL11-v2 — modernized-DOOM floating damage numbers.
 *
 * Reads as the same caliber of polish as DOOM Eternal / 2016 floating
 * crit numbers. Specifically:
 *
 *  - **Tier-colored by damage magnitude.** Small ticks read cool/dim
 *    (parchment), mid-damage warm (amber), heavy hits hot (ember /
 *    blood), kill-confirmed incandescent white-orange with a "✦"
 *    bullet prefix and a bold glyph weight. The player can read what
 *    they did peripherally.
 *  - **Punch-in scale.** Spawns at 1.25× target scale, eases down to
 *    1.0× over the first 140ms — the classic "POW" feel.
 *  - **Kill-confirm velocity boost.** Standard hits float at 1.4u/s;
 *    kill-confirms boost to 2.4u/s + larger base scale.
 *  - **Crit-stack on rapid same-target hits.** Multiple pellets / chain
 *    shots landing on the same enemy within 350ms combine into a
 *    running total ("47!" → "112!" → "189!"), the running total
 *    re-punches scale on each hit so the player feels the accumulation.
 *  - **Outlined + drop-shadow** for legibility on any backdrop. drei's
 *    Text gives us cheap outlined fill; we drop a second darker text
 *    underneath at +0.012 z-offset as the drop shadow.
 *  - **Camera-billboard, head-tracking.** Numbers spawn at the enemy's
 *    head height (1.6) and float up — they don't drift sideways (the
 *    older sketch did, but that's an anti-pattern: drift away from the
 *    target hurts target-tracking, which is the whole point).
 *
 * Pool budget: 24 concurrent. At chaingun cadence × 900ms TTL × crit-
 * stack consolidation, steady-state is ~6-10, so the cap is comfortable
 * headroom for shotgun pellet bursts (8 pellets all crit-stacking onto
 * one enemy = 1 visible number, not 8).
 *
 * Crit-stack mechanics: damageNumber events carry the enemy id (when
 * available — the wire format extension is in events.ts). If a new
 * event arrives within STACK_WINDOW_MS of an existing pool entry with
 * the same enemy id AND the pool entry hasn't yet crossed the punch-
 * scale window, we merge: sum the amount, refresh createdAt to re-punch
 * the scale, upgrade `killed` to true if the new hit was the killing
 * blow. Otherwise the new event spawns its own pool slot.
 */
type DamageNumber = {
	id: number; // pool-slot id (monotonic)
	enemyId: number | undefined; // for crit-stack matching
	x: number;
	y: number;
	amount: number;
	killed: boolean;
	createdAt: number;
	lastStackAt: number; // for crit-stack window — refreshes on each merge
};

const TTL_MS = 1000;
const PUNCH_MS = 140; // 1.25× → 1.0× ease window.
const STACK_WINDOW_MS = 350; // merge same-target hits inside this window.
const FLOAT_SPEED_HIT = 1.4; // world units / sec, upward — standard hit.
const FLOAT_SPEED_KILL = 2.4; // kill-confirms boost upward.
const MAX_NUMBERS = 24;

// Damage-tier color thresholds. Tuned to DOOM-clone weapon damages:
// pistol = 1, chaingun pellet = 2, shotgun pellet = 3, melee = 8.
// "tier" maps the per-event amount into a 0..3 bucket so the color
// reads as cool → warm → hot → incandescent.
function tierColor(amount: number, killed: boolean): string {
	if (killed) return "#fff4d6"; // incandescent white-amber — kill confirms
	if (amount >= 8) return SCALE.ember[300]; // heavy (melee, multi-pellet stack)
	if (amount >= 4) return SCALE.amber[200]; // mid (shotgun pellet, chaingun stack)
	if (amount >= 2) return SCALE.amber[300]; // standard chaingun pellet
	return SCALE.parchment[200]; // pistol tick — quiet
}

function tierBaseScale(amount: number, killed: boolean): number {
	if (killed) return 0.7;
	if (amount >= 8) return 0.5;
	if (amount >= 4) return 0.42;
	return 0.36;
}

export function DamageNumberField() {
	const [, force] = useState(0);
	const numbersRef = useRef<DamageNumber[]>([]);
	const nextId = useRef(1);

	useEffect(() => {
		return addObjexoomListener("damageNumber", (d: EventOf<"damageNumber">) => {
			const now = performance.now();
			const incomingEnemyId = d.enemyId;
			// Crit-stack: if the most-recent same-enemy slot is still
			// inside the stack window, merge into it.
			if (incomingEnemyId !== undefined) {
				// Scan from newest → oldest so we attach to the most recent slot.
				for (let i = numbersRef.current.length - 1; i >= 0; i -= 1) {
					const slot = numbersRef.current[i];
					if (slot.enemyId !== incomingEnemyId) continue;
					if (now - slot.lastStackAt > STACK_WINDOW_MS) break;
					slot.amount += d.amount;
					slot.killed = slot.killed || d.killed;
					// Refresh createdAt so the punch-scale re-fires — the
					// player sees the accumulation, not a frozen number.
					slot.createdAt = now;
					slot.lastStackAt = now;
					// Track the latest hit position so the number follows
					// the staggering enemy rather than freezing at the
					// first-hit spot.
					slot.x = d.x;
					slot.y = d.y;
					force((n) => n + 1);
					return;
				}
			}
			numbersRef.current.push({
				id: nextId.current++,
				enemyId: incomingEnemyId,
				x: d.x,
				y: d.y,
				amount: d.amount,
				killed: d.killed,
				createdAt: now,
				lastStackAt: now,
			});
			while (numbersRef.current.length > MAX_NUMBERS) numbersRef.current.shift();
			force((n) => n + 1);
		});
	}, []);

	useFrame(() => {
		const now = performance.now();
		const before = numbersRef.current.length;
		numbersRef.current = numbersRef.current.filter((n) => now - n.createdAt < TTL_MS);
		if (numbersRef.current.length !== before) force((n) => n + 1);
	});

	return (
		<group>
			{numbersRef.current.map((n) => {
				const now = performance.now();
				const age = (now - n.createdAt) / TTL_MS; // 0..1
				const opacity = Math.max(0, 1 - age * age); // ease-in fade — visible longer up front
				const floatSpeed = n.killed ? FLOAT_SPEED_KILL : FLOAT_SPEED_HIT;
				const lift = age * floatSpeed * (TTL_MS / 1000);
				// Punch-in scale: 1.25× → 1.0× ease-out over PUNCH_MS.
				const punchT = Math.min(1, (now - n.createdAt) / PUNCH_MS);
				const punchEase = 1 - (1 - punchT) * (1 - punchT); // ease-out quad
				const punchScale = 1.25 - 0.25 * punchEase;
				const baseScale = tierBaseScale(n.amount, n.killed);
				const fontSize = baseScale * punchScale;
				const color = tierColor(n.amount, n.killed);
				const label = n.killed ? `✦${n.amount}` : String(n.amount);
				return (
					<group key={n.id} position={[n.x, 1.6 + lift, n.y]}>
						{/* Drop shadow — second darker text behind, slight z offset. */}
						<Text
							position={[0.02, -0.02, -0.012]}
							fontSize={fontSize}
							color="#000000"
							anchorX="center"
							anchorY="middle"
							fillOpacity={opacity * 0.55}
							outlineWidth={0}
						>
							{label}
						</Text>
						<Text
							fontSize={fontSize}
							color={color}
							anchorX="center"
							anchorY="middle"
							fillOpacity={opacity}
							outlineWidth={n.killed ? 0.035 : 0.022}
							outlineColor="#1a0606"
							outlineOpacity={opacity * 0.85}
							fontWeight={n.killed ? 900 : 700}
						>
							{label}
						</Text>
					</group>
				);
			})}
		</group>
	);
}
