---
title: Slot Architecture for Visual + Audio Feedback
updated: 2026-05-14
status: current
domain: technical
---

# Slot Architecture for Visual + Audio Feedback

## The problem this exists to solve

Phase 12 + Phase 13 polish work has repeatedly tripped the same
shape of bug because each new feedback feature is **bolted into the
next available crevice of an existing component** instead of
mounting in its own slot:

| Symptom | Root |
|--------|------|
| POL14 first-cut tried `effectRef.current.offset.set(...)` and broke at runtime because drei wraps the effect | Tried to reach INTO an existing pass instead of owning a self-contained effect |
| POL19 enemy hit flash hammered material-clone + stagger-watch + tint-modulation into `EnemyMesh`'s `useFrame` alongside skeleton anim + bob + facing | One component, five responsibilities |
| POL20 swap dip jamming `useRef` + `useEffect([weapon])` into WeaponViewmodel — biome correctly flagged `weapon` as unused inside the effect, because the effect should be an external observer of the prop, not a trigger inside the model | Mixing "render the weapon" with "observe weapon changes" inside one component |
| POL21 + POL8 audio collisions on `pickupSynth`/`boomSynth`/`boomNoise`/`ambientDrone` | Every audio cue owns its own `last*FireTime` global; no bus |

The user called this out: *"if that's happening it means you need to think more about slots."*

The slot pattern says: **each feedback feature is a self-contained
component (or call into a bus channel), mounted into a named slot,
with one job and one event listener. The slot is the integration
point; the component is the implementation.**

## The slot inventory

### 1. HUD overlay slots — `<HUDOverlays>`

Parent component mounted once in `ObjexoomHUD`. Each transient
overlay (SecretFoundFlash, DamageOverlay, FuturePickupCeremony,
FutureKillStreak) is a self-contained sibling.

Contract for any HUD overlay:

```tsx
function FooOverlay() {
	const [activeKey, setActiveKey] = useState(0);
	useEffect(() => addObjexoomListener("foo", () => setActiveKey(k => k + 1)), []);
	if (activeKey === 0) return null;
	return <motion.div key={activeKey} ... />;
}
```

- Self-contained: owns its own event listener + animation state.
- Composable: `<HUDOverlays>` is a fragment of overlays; adding a new one is a one-line import + JSX append.
- Canonical-byte-stable: returns null until the first event so the canonical screenshots are unaffected.

### 2. Postprocessing slots — under `<EffectComposer>`

Each effect is its own component owning its uniform state. The
`HitChromaticAberration` shape is the reference:

```tsx
export function HitChromaticAberration() {
	const offset = useMemo(() => new Vector2(BASE_X, BASE_Y), []);
	const pulseUntil = useRef(0);
	useEffect(() => addObjexoomListener("playerHit", () => { ... }), []);
	useFrame(() => { /* mutate offset */ });
	return <ChromaticAberration offset={offset} />;
}
```

- Self-contained: owns its Vector2 / scalar uniform state.
- No ref-into-the-wrapper antipattern.
- Mounted as a sibling under `<EffectComposer>` in ObjexoomScene.

### 3. Per-entity feedback slots — sibling components

Render-the-thing component stays focused on rendering the thing.
Feedback companions are separate siblings keyed by the entity:

```tsx
{enemies.map(enemy => (
	<group key={enemy.id}>
		<EnemyMesh enemy={enemy} register={...} />
		<EnemyHitFlash enemy={enemy} />     {/* POL19 — separate slot */}
		<EnemyDeathSettle enemy={enemy} /> {/* POL25 — future, slotted */}
	</group>
))}
```

- `EnemyMesh` keeps anim + bob + facing + mesh sync; nothing about hits.
- `EnemyHitFlash` owns: material-clone-on-mount, stagger watch, ease curve, tint lerp. Reads `enemy.staggerUntil`. Mutates the same materials EnemyMesh rendered. Owns the cleanup.
- New feedback features (death settle, idle glint, low-HP red-emissive) become new sibling slots; no churn in EnemyMesh.

### 4. Audio bus slot — `AudioBus`

Replace the explosion of free `playFoo()` functions + per-voice
`last*FireTime` globals with a single bus:

```ts
class AudioBus {
	private channels = new Map<string, { lastFireTime: number; synth: ToneInstrument }>();
	fire(channelId: string, schedule: (t: number) => void) {
		const ch = this.channels.get(channelId)!;
		const t = jitter(ch.lastFireTime);
		ch.lastFireTime = t;
		schedule(t);
	}
}
```

- One jitter implementation, used everywhere.
- Channels are typed + enumerated, so adding `secret-found` doesn't accidentally collide with `pickup`.
- Existing `playFoo()` calls become `bus.fire('foo', t => ...)` shells — refactor in-place without touching call sites' semantics.

This is the largest of the four slots and the last one to land — POL8 + POL21 collision-fix-forward absorbed the immediate pain, but the next audio cue will surface it again.

## When a feature is NOT a slot

Not every feature is a slot. Things that ARE legitimately part of an
existing component:

- **The per-frame work that owns the rendered transform.** WeaponViewmodel's recoil offset is part of "render the weapon"; same for the head bob in PlayerController.
- **State that the host component owns and other features observe.** `Enemy.staggerUntil` is set by `fireResolution` (owns hit→damage→state), READ by EnemyHitFlash (a slot). The data lives where it's mutated; the visual lives in the slot.
- **Cross-cutting renderer concerns** (postprocessing composition, EffectComposer order). Those are renderer config, not slots.

## The migration order

Existing bolted-in features get retrofitted in this order:

1. **POL19 enemy hit flash → `<EnemyHitFlash>` sibling.** Highest pain because EnemyMesh has the most other responsibilities.
2. **POL12 hitstop → ref already-shared between fireResolution + enemyTickLoop.** This is fine as-is (data lives where it's mutated, behavior is a single read inside the existing tick); no slot needed.
3. **POL18 door open puff → already a `dispatch({type: "burst"})` event, which IS the slot pattern. Audio still inline; pending the AudioBus.**
4. **AudioBus refactor — last, biggest. Refactor `sfx.ts` from 25 free functions + 15 global timers into one bus with named channels.**

## When proposing the next polish item, ask:

- Does this feature observe an existing entity / event / pose? Then it's a slot — mount as a sibling, listen, render, fade.
- Does this feature change how the rendered thing is rendered? Then it's part of the host component's render contract — own it there.
- Does this feature fire audio? Then it's a bus channel — `bus.fire('channel-id', schedule)`.

If none of the three answer cleanly, sit with the design before
writing code.
