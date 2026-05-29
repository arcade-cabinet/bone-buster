import { A } from "@assets/assetUrl";
import { addBoneBusterListener, type EventOf } from "@engine/events";
import { useFrame, useThree } from "@react-three/fiber";
import { SCALE } from "@styles/tokens/index";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { Group } from "three";
import { configureTextBuilder, Text as TroikaTextMesh } from "troika-three-text";

// ERR2 — run troika's glyph typesetting on the MAIN THREAD (useWorker: false).
// troika defaults to a Web Worker (troika-worker-utils) for SDF generation, but
// Vite's dep pre-bundler mangles that worker module's init, throwing `Worker
// module function was called but init did not return a callable function` 40+
// times per in-game mount (the font worker never produces glyphs). Main-thread
// typesetting sidesteps the broken worker entirely. MUST run before the first
// getTextRenderInfo/font request (troika ignores a late call + warns), so it
// lives at module scope next to the troika import — this module is imported by
// the Scene before any Text mounts. Per-frame cost is negligible (damage numbers
// are short strings) and SDF results are cached.
configureTextBuilder({ useWorker: false });

// POL11 fix — pin troika's font to a bundled woff. Without an explicit `font`,
// troika's unicode-font-resolver issues a runtime `fetch()` to a jsdelivr CDN
// to resolve glyph coverage; if that fetch rejects (offline, headless e2e, or a
// blocked CDN) the rejection surfaces *synchronously inside the <Text> render*,
// which aborts React's commit of the entire BoneBusterScene subtree before its
// effects run — so the e2e debug listeners never register and gameplay setup
// silently dies. A bundled font removes the network dependency entirely.
const DAMAGE_FONT = A("assets/fonts/black-ops-one-400-latin.woff2");

// POL11 ROOT-CAUSE fix — non-suspending troika text. drei's <Text> calls
// `suspend(() => preloadFont(...))` on EVERY render (even with an explicit
// `font`), so it suspends the slot subtree until troika's font worker resolves.
// In the isolated browser-test Canvas (and any headless/offline context) that
// pipeline never resolves, so the slot <group>s never commit and the structural
// pool never appears. We render the troika Text primitive DIRECTLY here: the
// mesh is constructed synchronously and committed at first render (pool exists
// immediately), and glyph population happens async via .sync() WITHOUT
// suspending — so the scene commits in every context, troika or not. Glyph
// props (text/font/fontSize/color/weight) are set DECLARATIVELY via TroikaText
// props; the per-frame loop only animates the parent group's position+scale and
// the two opacity uniforms — no per-frame .sync() / glyph re-layout.
type TroikaTextProps = {
	font?: string;
	text: string;
	/**
	 * Base glyph size, set DECLARATIVELY (once per label change). The punch /
	 * float animation scales the parent <group> in the frame loop instead of
	 * mutating fontSize per-frame — changing fontSize marks troika's text
	 * geometry dirty and forces a full CPU glyph re-layout every frame
	 * (gemini-flagged). group.scale is a cheap matrix transform with no rebuild.
	 */
	fontSize?: number;
	color?: string;
	position?: [number, number, number];
	anchorX?: "center" | "left" | "right";
	anchorY?: "middle" | "top" | "bottom";
	outlineWidth?: number;
	outlineColor?: string;
	fontWeight?: number | "normal" | "bold";
};

const TroikaText = forwardRef<TroikaTextMesh, TroikaTextProps>(function TroikaText(
	{
		font,
		text,
		fontSize,
		color,
		position,
		anchorX,
		anchorY,
		outlineWidth,
		outlineColor,
		fontWeight,
	},
	ref,
) {
	const invalidate = useThree((s) => s.invalidate);
	const [mesh] = useState(() => new TroikaTextMesh());
	useImperativeHandle(ref, () => mesh, [mesh]);
	// Push declarative props onto the mesh, then sync glyphs async. No suspend:
	// commit is never blocked on troika's font/worker pipeline resolving.
	useLayoutEffect(() => {
		mesh.font = font ?? null;
		mesh.text = text;
		if (fontSize !== undefined) mesh.fontSize = fontSize;
		if (color !== undefined) mesh.color = color;
		if (anchorX !== undefined) mesh.anchorX = anchorX;
		if (anchorY !== undefined) mesh.anchorY = anchorY;
		if (outlineWidth !== undefined) mesh.outlineWidth = outlineWidth;
		if (outlineColor !== undefined) mesh.outlineColor = outlineColor;
		if (fontWeight !== undefined) mesh.fontWeight = fontWeight;
		mesh.sync(() => invalidate());
	});
	useEffect(() => () => mesh.dispose(), [mesh]);
	return <primitive object={mesh} position={position} />;
});

// Minimal structural surface of the troika text mesh the frame loop mutates.
// Text/font/size/color/weight are all set DECLARATIVELY (TroikaText props, only
// on a label re-render), so the per-frame path touches ONLY the two opacity
// uniforms — which are live material props requiring no .sync() / geometry
// rebuild. Keeping this surface tiny documents that the hot loop does no glyph
// re-layout.
type MutableText = {
	fillOpacity: number;
	outlineOpacity: number;
};

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

// CR-R1 — fixed pre-mounted slot pool. Each of MAX_NUMBERS slots is a
// group + (shadow text, main text) mounted ONCE; the frame loop drives
// position / scale / opacity / label imperatively and toggles `visible`.
// The React tree only re-renders when the slot↔number ASSIGNMENT changes
// (spawn/despawn), never per frame — the old code called force() every
// frame, re-running the whole .map() + re-instantiating troika SDF text
// at frame cadence during combat.
type SlotRefs = {
	group: Group | null;
	shadow: MutableText | null;
	main: MutableText | null;
};

export function DamageNumberField() {
	const [, force] = useState(0);
	const numbersRef = useRef<DamageNumber[]>([]);
	const nextId = useRef(1);
	const slotRefs = useRef<SlotRefs[]>(
		Array.from({ length: MAX_NUMBERS }, () => ({ group: null, shadow: null, main: null })),
	);

	useEffect(() => {
		return addBoneBusterListener("damageNumber", (d: EventOf<"damageNumber">) => {
			const now = performance.now();
			const incomingEnemyId = d.enemyId;
			// Crit-stack: if the most-recent same-enemy slot is still
			// inside the stack window, merge into it.
			if (incomingEnemyId !== undefined) {
				// Scan from newest → oldest so we attach to the most recent slot.
				for (let i = numbersRef.current.length - 1; i >= 0; i -= 1) {
					const slot = numbersRef.current[i];
					if (slot === undefined) continue;
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
					// Merge mutates an existing slot's label/amount — re-render
					// once so the (rarely-changing) text content updates.
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
			// Spawn changes the slot assignment → one re-render to bind labels.
			force((n) => n + 1);
		});
	}, []);

	useFrame(() => {
		const now = performance.now();
		const numbers = numbersRef.current;
		// Despawn expired in place; re-render only if the set actually shrank.
		const before = numbers.length;
		let w = 0;
		for (let r = 0; r < numbers.length; r++) {
			const n = numbers[r];
			if (n === undefined) continue;
			if (now - n.createdAt >= TTL_MS) continue;
			numbers[w++] = n;
		}
		numbers.length = w;
		// Drive every slot imperatively — no per-frame React render.
		const slots = slotRefs.current;
		for (let i = 0; i < MAX_NUMBERS; i++) {
			const slot = slots[i];
			const n = numbers[i];
			if (!slot?.group) continue;
			if (n === undefined) {
				slot.group.visible = false;
				continue;
			}
			const age = (now - n.createdAt) / TTL_MS; // 0..1
			const opacity = Math.max(0, 1 - age * age); // ease-in fade
			const floatSpeed = n.killed ? FLOAT_SPEED_KILL : FLOAT_SPEED_HIT;
			const lift = age * floatSpeed * (TTL_MS / 1000);
			const punchT = Math.min(1, (now - n.createdAt) / PUNCH_MS);
			const punchEase = 1 - (1 - punchT) * (1 - punchT); // ease-out quad
			const punchScale = 1.25 - 0.25 * punchEase;
			slot.group.visible = true;
			slot.group.position.set(n.x, 1.6 + lift, n.y);
			// Punch animates the GROUP scale (cheap matrix transform), NOT
			// fontSize — base glyph size is set declaratively per label, so
			// troika does no per-frame geometry re-layout. fillOpacity /
			// outlineOpacity are live material uniforms: set directly, no
			// per-frame .sync() (sync only matters for text/font/layout changes,
			// which don't happen during the float animation).
			slot.group.scale.setScalar(punchScale);
			if (slot.shadow) {
				slot.shadow.fillOpacity = opacity * 0.55;
			}
			if (slot.main) {
				slot.main.fillOpacity = opacity;
				slot.main.outlineOpacity = opacity * 0.85;
			}
		}
		if (w !== before) force((k) => k + 1); // set shrank → rebind labels
	});

	// Mount a fixed pool of slots once. Label/color/weight come from the
	// number currently assigned to each slot index (stable across frames;
	// only changes on the spawn/despawn/merge re-renders above).
	return (
		<group>
			{Array.from({ length: MAX_NUMBERS }, (_, i) => {
				const n = numbersRef.current[i];
				const label = n ? (n.killed ? `✦${n.amount}` : String(n.amount)) : "";
				const color = n ? tierColor(n.amount, n.killed) : "#ffffff";
				const killed = n?.killed ?? false;
				// Base glyph size set DECLARATIVELY here (only re-runs on the
				// spawn/despawn/merge re-render, not per frame). The punch + float
				// animation scales the parent <group> in the frame loop — no
				// per-frame fontSize mutation → no per-frame glyph re-layout.
				const baseSize = n ? tierBaseScale(n.amount, n.killed) : 1;
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size slot pool keyed by index by design
					<group key={i} visible={false} ref={(g) => bindSlot(slotRefs.current, i, "group", g)}>
						<TroikaText
							font={DAMAGE_FONT}
							position={[0.02, -0.02, -0.012]}
							fontSize={baseSize}
							color="#000000"
							anchorX="center"
							anchorY="middle"
							outlineWidth={0}
							text={label}
							ref={(t) => bindSlot(slotRefs.current, i, "shadow", t)}
						/>
						<TroikaText
							font={DAMAGE_FONT}
							fontSize={baseSize}
							color={color}
							anchorX="center"
							anchorY="middle"
							outlineWidth={killed ? 0.035 : 0.022}
							outlineColor="#1a0606"
							fontWeight={killed ? 900 : 700}
							text={label}
							ref={(t) => bindSlot(slotRefs.current, i, "main", t)}
						/>
					</group>
				);
			})}
		</group>
	);
}

function bindSlot(slots: SlotRefs[], i: number, key: keyof SlotRefs, node: unknown): void {
	const slot = slots[i];
	if (!slot) return;
	// biome-ignore lint/suspicious/noExplicitAny: r3f ref node typed structurally as the field
	(slot as any)[key] = node ?? null;
}
