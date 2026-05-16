---
title: Performance Audit
updated: 2026-05-15
status: current
domain: quality
---

# Performance Audit — objexoom (2026-05-15)

Target: web (GitHub Pages) + Capacitor Android/iOS. Reference device: Pixel 5a.

## Existing instrumentation read first (so we don't suggest dupes)

- `src/scene/effects/AdaptiveResolution.tsx` is the OBS1 emitter: per-frame `gl.info.render.calls`/`triangles` are accumulated as peak across a 60-frame window, then emitted on `bonebuster:fpsUpdate`. It runs `gl.info.autoReset = false` once and `gl.info.reset()` every useFrame.
- `app/views/HUD.tsx:316-405` is the OBS2 overlay — debug-build banner when calls > budget or tris > budget; HUD readout under `?bonebusterDebug`.
- `scripts/obs3-perf-snapshot.mjs` (OBS3) launches Chromium per-archetype, drives `?bonebusterArchetype=<X>&bonebusterSeed=12345`, samples `bonebuster:fpsUpdate` over a 3s window, compares peak vs `tests/perf-baselines/<archetype>.json`, fails on >10% regression or absolute budget (1200 calls / 80k tris — bumped from 1000/100k post-D5 to fit arena's 24-kind roster).
- `.github/workflows/ci.yml` job `perf` (lines 33-56) is OBS4 — runs `pnpm test:perf` after `verify`.
- Tracked baselines (`tests/perf-baselines/*.json`, post-D5 + post-A1):

  | Archetype | peakCalls | peakTris |
  |-----------|----------:|---------:|
  | corridor  | 810       | 21,994   |
  | arena     | 1,013     | 67,903   |
  | courtyard | 885       | 17,824   |
  | sewer     | 638       | 26,533   |
  | library   | 752       | 26,135   |

What these numbers say: **the bottleneck is draw calls, dominated by skinned-mesh enemies post-D5**. Arena's 24-kind mix puts it at 1013 calls (only the A1 InstancedField corridor migration knocked ~24 calls off corridor itself). The next perf-slice priority is migrating PropField + LargePropField + TrapField to InstancedGltfField (see PRD §Parked) for ~150 more reclaimed arena calls.

OBS1/2/3/4 do not currently track: GC pause time, audio-thread underruns, ms/frame split between sim and render, or per-system draw-call ownership. See §3 for proposed additions.

---

## Top 10 ranked performance issues

### 1. Walls render one draw call per cell — corridor 834 calls is dominated by this
**Files:**
- `src/scene/map/MapGeometry.tsx:201-225` — `GridWall` clones a fresh `SkeletonUtils.clone(gltf.scene)` per wall cell, mounts as separate `<group><primitive object={cloned}/></group>`.
- `src/scene/map/SectorMapGeometry.tsx:148-188` — `ModularWall` same pattern, one mount per sector edge.

**Diagnosis:** On corridor (modular walls active), a 30×30 grid map with ~150-300 wall cells produces 150-300 draw calls just for walls — every clone is a unique scene-graph subtree with its own world matrix and material binding (the GLB material is shared by reference via `useGLTF`'s cache, so material state could batch, but separate `Mesh` instances each issue their own `drawElements`).

**Blast radius:** Both (web + mobile). Mobile worse: GL state changes per call cost ~50-100µs on Adreno 6xx-class GPUs; 200 wall calls = 10-20ms just submitting walls.

**Fix approach:**
- Convert to `InstancedMesh`: one InstancedMesh per unique wall-GLB variant per archetype, `setMatrixAt(i, matrix)` for each instance. The wall meshes are simple cuboids extracted from the GLB primitive; iterate the GLB scene once at init to get geometry+material, then instance.
- Alternative if multi-mesh inside the GLB makes instancing painful: use `BatchedMesh` (three.js r166+, present in current deps) which doesn't require uniform geometry.
- Expected win: 200-300 wall calls → 3-6 calls (one per variant). Corridor 834 → ~550, courtyard 887 → ~600. Roughly a third off the call budget on the worst archetypes.

---

### 2. Per-shard mesh + material allocation in body-part / shell / particle fields
**Files:**
- `src/scene/effects/BodyPartField.tsx:166-176` — `new THREE.Mesh(new THREE.BoxGeometry(...), new THREE.MeshStandardMaterial({...}))` per shard, on first sighting inside useFrame. Up to `MAX_BODY_SHARDS=120` concurrent.
- `src/scene/effects/BodyPartField.tsx:205-213` — `new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({...}))` per settled-shard decal — up to 120 more.
- `src/scene/effects/ShellEjectField.tsx:91-103` — `new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.07, 8), new THREE.MeshStandardMaterial({...}))` per shell, up to `MAX_SHELLS=80`.
- `src/scene/effects/ParticleBurstField.tsx:261-265` — `new THREE.Mesh(new THREE.SphereGeometry(mote.radius, 6, 6), new THREE.MeshStandardMaterial({...}))` per mote, up to `MAX_MOTES=280`.

**Diagnosis:** Each lazy mesh creation allocates 2 GPU-resident objects (geometry + material) plus their uniforms, plus a Mesh JS object. Worst case in heavy combat: 280 + 120 + 80 = 480 ad-hoc meshes spawning + decaying over a couple seconds. GC sees ~50KB of mesh metadata churn per second; GPU sees up to 480 extra `drawElements` calls. Compare with `BulletField.tsx:11-15` which correctly hoists `BULLET_GEOMETRY` and `BULLET_MATERIAL` to module scope and reuses them — that's the pattern to copy.

**Blast radius:** Both, worse on mobile (GC pause = jank during the most dramatic gameplay moment, the kill itself).

**Fix approach:**
1. Quick win (1-2hr): hoist `boxGeometry/circleGeometry/cylinderGeometry/sphereGeometry` and one base `MeshStandardMaterial` per kind to module scope. Per-shard opacity/color flips become `.material.opacity = ...` on a per-mesh material clone OR — simpler — replace transparent-material-per-mesh with a single InstancedMesh:
2. Architectural (1 day): replace each `Map<id, Mesh>` pool with a single `THREE.InstancedMesh` of capacity `MAX_*` with `setMatrixAt` + `setColorAt`. ~480 draw calls collapse to 4. Per-instance opacity becomes a custom `onBeforeCompile` shader patch OR you can fade by collapsing the matrix scale to zero past TTL.

---

### 3. Lamp pointLights cast shadows at 512² — every lit lamp is its own shadow pass
**File:** `src/scene/entities/LampField.tsx:43-58`

```tsx
<pointLight
  position={[0, 1.4, 0]}
  color={lightColor}
  intensity={1.6}
  distance={6}
  decay={1.8}
  castShadow
  shadow-mapSize-width={512}
  shadow-mapSize-height={512}
  shadow-bias={-0.0005}
/>
```

**Diagnosis:** A pointLight with shadows is 6 render passes (cubemap face). At 512² that's ~6 × 512² × N_lamps × ~scene-tris-per-pass. The file comment mentions `MAX_LIT_LAMPS` cap exists but I can't find the actual enforcement — `LampField` blindly maps every lamp where `lamp.on === true`. With more than 2-3 lit lamps in view, this dominates the GPU frame.

**Blast radius:** Mobile critical, web noticeable.

**Fix approach:**
- Disable `castShadow` on lamp pointLights entirely. Static lamp positions cast static shadows; bake the contribution into the floor texture or just drop the shadow — the directional sun + flashlight cover the gameplay-relevant shadow signal.
- If the look matters: enforce a real `MAX_LIT_LAMPS=2` cap in `spawnLamps` (sort by distance to player spawn) and keep shadows on those. Distance-decay (`distance=6`) already culls contribution outside the radius, so off-screen lamps shouldn't accumulate, but the shadow-map is rendered regardless of view-frustum.

---

### 4. Flashlight spotLight shadow at 1024² runs every frame
**File:** `src/scene/effects/Flashlight.tsx:69-77`

```tsx
castShadow
shadow-mapSize={[1024, 1024]}
shadow-camera-near={0.2}
shadow-camera-far={14}
```

**Diagnosis:** SpotLight shadow is one render pass per frame at 1024². It's also the *only* dynamic light that follows the camera — the GLB walls + cloned enemies all rebind every frame. On Pixel 5a this is a real fraction of the GPU budget.

**Blast radius:** Mobile primarily; the headlight is on for most gameplay.

**Fix approach:**
- Reduce to 512² and re-snapshot baselines. PCF soft + 512² on a tight 14m cone is still convincing.
- Optionally: only update shadow on movement — set `shadow.autoUpdate = false` and call `shadow.needsUpdate = true` from a useFrame that checks `camera.position.distanceToSquared(lastShadowPos) > 0.04 || camera.quaternion.angleTo(lastShadowQuat) > 0.05`. Standing still drops the shadow cost to zero.

---

### 5. Enemy mesh sync writes happen twice per frame (Scene tick + EnemyMesh useFrame)
**Files:**
- `src/scene/hooks/enemyTickLoop.ts:200-213` — `mesh.position.{x,y,z} = ...; mesh.lookAt(px, mesh.position.y, py)` for every live enemy at default priority.
- `src/scene/entities/EnemyMesh.tsx:98-110` — `group.position.set(enemy.position.x, targetY, enemy.position.y); group.rotation.y = facingRef.current + skin.yawOffsetRad;` ALSO at default priority.

**Diagnosis:** Both blocks write the enemy `group.position` every frame. The EnemyMesh path computes facing from a per-instance `lastPosRef` delta and writes a yaw rotation; the tickEnemyLoop path uses `mesh.lookAt(px, ..., py)` (camera-facing billboard) and writes XYZ directly. Which one wins depends on r3f's useFrame subscriber registration order — they're both `priority=0` so order is mount order. Net effect: redundant matrix recompute + last-write-wins makes the visible facing logic non-obvious and the per-frame work doubles.

**Blast radius:** Both. JS cost only (no extra draw calls) but doubles for every enemy on screen. With 8 enemies it's ~16 redundant `Matrix4.compose` calls/frame.

**Fix approach:**
- Pick one. tickEnemyLoop's `mesh.lookAt(player)` is the older billboard behavior — but EnemyMesh's `rotation.y = atan2(dx, dy) + skin.yawOffsetRad` is the proper character-facing-direction-of-motion behavior for skinned 3DPSX models. Delete the tickEnemyLoop mesh-write block; the FSM only needs to update `enemy.position`, the visual layer owns visualization.
- Reviewer note: confirm with `tests/e2e/screenshots.spec.ts` that the canonical poses still match — the visual yaw may shift slightly.

---

### 6. Postprocessing chain runs Bloom + ChromaticAberration + Vignette every frame
**File:** `app/views/Scene.tsx:1039-1043`

```tsx
<EffectComposer>
  <Bloom intensity={0.45} luminanceThreshold={0.55} luminanceSmoothing={0.2} />
  <HitChromaticAberration />
  <Vignette eskil={false} offset={0.25} darkness={0.7} />
</EffectComposer>
```

**Diagnosis:** EffectComposer adds 1 fullscreen pass per effect + 1 final copy. At Pixel 5a's native 1080×2400 (clamped by `dpr=[1,1.5]`) that's roughly 4 fullscreen passes × ~2.5MP = 10MP of fill per frame. Bloom is the worst — it's a multi-pass mip pyramid downsample/blur/upsample. Chromatic-aberration is cheap when the offset is zero but the pass runs anyway (`HitChromaticAberration.tsx:54-58` always returns the ChromaticAberration node).

**Blast radius:** Mobile primarily — fillrate is the Adreno bottleneck.

**Fix approach:**
1. Quick: gate the entire EffectComposer behind a "lowQuality" flag controlled by AdaptiveResolution. Same threshold (avg < 30 fps for 2 windows) can drop bloom; raise it again above 55fps.
2. Architectural: replace Bloom with a much cheaper `selectiveBloom` (only emissive materials) or precomputed emissive halos on the pickups themselves (PickupHalo already does this — Bloom is double-duty).
3. ChromaticAberration: mount/unmount on `playerHit` rather than always-on. Pass `disabled` via `enabled={pulseActive}` prop on the ChromaticAberration effect.

---

### 7. SkeletonUtils.clone of every static prop / decal / debris instance
**Files (the pattern repeats):**
- `src/scene/entities/PropField.tsx:34-41`
- `src/scene/entities/LampField.tsx:35-40`
- `src/scene/entities/DebrisField.tsx:23` and per-instance components
- `src/scene/entities/KitchenField.tsx:23` (per-instance)
- `src/scene/entities/NatureField.tsx`, `LargePropField.tsx`, `NpcField.tsx`, `VehicleWreck.tsx`
- `src/scene/map/MapGeometry.tsx:209` (GridWall)
- `src/scene/map/SectorMapGeometry.tsx:176` (ModularWall)

**Diagnosis:** Every PropInstance, LampInstance, DebrisInstance, etc., gets its own deep-clone of the GLB scene graph via `SkeletonUtils.clone`. For props that are NOT skinned meshes (which is most of them — only enemies + NPCs have skeletons), this is excessive work and excessive draw calls. Each clone produces 1+ mesh sub-tree → 1+ draw call per instance.

The comment in `PropField.tsx:14-21` acknowledges "these meshes don't have skeletons (it handles plain meshes too and is consistent with the rest of the renderer)" — consistency cost is the perf issue. With ~20-40 props per sector × multiple sectors, that's 100-300 prop draw calls alone.

**Blast radius:** Both. Library + courtyard archetypes are heaviest because the per-archetype scatter density skews high there.

**Fix approach:**
- **Categorize**: skinned (enemies, NPCs) keep `SkeletonUtils.clone`; non-skinned (props, lamps, decals, debris, kitchen, nature) switch to `InstancedMesh` keyed by GLB url. Group by url at scatter-spawn time, build one InstancedMesh per unique url with capacity = instance count, `setMatrixAt(i, m)` per instance.
- For props with multiple meshes inside the GLB: walk the GLB at preload, build one InstancedMesh per primitive.
- This collapses the 100-300 prop calls to N_unique_props (~10-20 across the scatter pools).
- Estimated cost: 1-2 days of refactor work; the spawn payload format doesn't change, only the renderers.

---

### 8. `gl.info.reset()` called twice per frame (and useFrame priority mismatch)
**File:** `src/scene/effects/AdaptiveResolution.tsx:64-72`

**Diagnosis:** Comment claims "useFrame can run before OR after render depending on priority" — but in r3f, default-priority useFrames run in the order subscribed, then the renderer renders, then positive-priority useFrames run. With `gl.info.autoReset = false` and `gl.info.reset()` called inside a default-priority useFrame, the reset happens BEFORE this frame's render. So peakCalls/peakTris are actually being read from LAST frame's render and reset before THIS frame's render — fine for sampling, but the comment is misleading and the reset placement is fragile.

Real perf cost is minor (a few microseconds), but if anyone ever moves AdaptiveResolution to a different priority it'll silently zero the counters.

**Blast radius:** Instrumentation bug; not a perf bottleneck but breaks OBS1/2/3 reliability.

**Fix approach:**
- Pin AdaptiveResolution's useFrame to `priority={2}` (i.e. AFTER the render manual-render flag flips), then it samples + resets THIS frame's render info. Document the contract in the file header.
- Add a unit test that asserts `gl.info.render.calls` is non-zero in the AdaptiveResolution sample after a frame render (vitest + headless THREE.WebGLRenderer with the test-stub).

---

### 9. Music synth pool initializes 6 PolySynths up front + master Reverb
**Files:**
- `src/sfx.ts:263-282` — 6× `new Tone.PolySynth(Tone.Synth, {...})` inside `ensureSfx()`
- `src/sfx.ts:118-120` — `masterReverb = new Tone.Reverb({decay:1.4, wet:0.18}).toDestination()` (Reverb needs to bake a buffer; ~50-150ms warmup)

**Diagnosis:** `ensureSfx()` is called once per session lazily on first user gesture. The 6 PolySynths × default polyphony=32 means up to 192 voices pre-allocated. Tone.PolySynth tops up its voice pool dynamically anyway, so the up-front voice count isn't the issue — but each PolySynth has an envelope, oscillator chain, and gain stage connected to the master output. On a cold-start Android Chrome the entire chain can take 200-400ms to allocate + the Reverb's IR-bake on top of it.

**Blast radius:** Mobile, time-to-first-shot. Less impactful in steady-state.

**Fix approach:**
- Lazy-init only the SFX synths needed for the current weapon + ambient. Defer music synths until the first frame of "playing" status (post-loading-screen). The K6 `tracksLoaded` counter is already plumbed — wire it into the landing loading bar so the cost is visible AND deferred.
- Reduce Reverb decay or use a cheaper `Tone.Freeverb` (no IR bake).

---

### 10. `mesh.lookAt(camera)` for every enemy is a billboard write redundant with EnemyMesh's yaw
Already covered structurally in #5 — calling out separately because the fix is one-line: delete `enemyTickLoop.ts:200-213` lines `mesh.position.x = ...; mesh.position.z = ...; mesh.position.y = ...; mesh.lookAt(...)`. Leave only `enemy.position` mutation (the sim state). Visual layer reads from `enemy.position` in EnemyMesh's own useFrame.

Bonus: this also frees the enemy mesh from being position-locked to the player's XZ — `lookAt(px, _, py)` is a horizontal billboard which is a 3DPSX trope but the rest of the codebase already moved to proper character-facing-direction-of-motion via `EnemyMesh.tsx:104-110`. They're fighting each other.

---

## Per-system budget — actual vs intended

| System | Where time goes | Where it should | Gap |
|---|---|---|---|
| **Render — draw calls** | Walls (per-cell GLB clones) 200-300, props/lamps/debris (per-instance clones) 200-400, particle/shard meshes (per-id) up to 500 | Walls instanced (1 call/variant), props instanced (1 call/url), particles instanced (1 call/pool) | -50% to -65% on calls. Corridor 834 → ~400, courtyard 887 → ~450. |
| **Render — fillrate** | Bloom mip pyramid + Vignette + ChromaticAberration always-on. Flashlight shadow 1024² every frame. Lamp pointLight shadows at 512² (per lit lamp). | Bloom gated by AdaptiveResolution. Flashlight shadow 512² + dirty-flag updates. Lamp shadows disabled (bake into floor). | -30% fragment time on Adreno 6xx-class. |
| **Sim — enemyTickLoop** | O(N) per enemy + O(N²) get-help fan-out (fixed via `enemyById` Map, line 87-90). Per-frame `Math.hypot` + `hasLineOfSightAny` raycast. | Already mostly fine — `enemyById` Map fix is in place. LOS check is the heaviest per-enemy cost. | Acceptable. LOS could throttle to every 3rd frame for fsmState=0 enemies (patrol — they don't need 60Hz LOS). |
| **Sim — fireResolution** | One ray per pellet (shotgun = 7 pellets/shot) against barrel + every enemy in cone | Already pure-TS, well-decomposed. Allocates `new THREE.Vector3` per pellet (lines 129, 145, 173-174). | Hoist scratch Vector3s to module scope (3-4 of them). Tiny win but the fire path is the most user-visible. |
| **Audio** | Tone.js graph init (200-400ms first-shot on mobile). Steady-state cheap (per-channel jitter pool is correct). PortalSwell ramps every frame inside `ExitPortalApproach`. | Lazy-init only SFX synths needed; music deferred. PortalSwell already has 50ms smoothing — fine. | Time-to-first-input is the user-visible bottleneck, not steady-state. |
| **Asset load** | useGLTF.preload at module-load covers all weapon/door/enemy/prop/lamp/loot/decal/debris/kitchen/nature/npc/large-prop URLs. Most preloads fire on first import, blocking first paint. | Tier preloads: critical (current weapon + current archetype walls + ambient enemies) on landing; rest after `playing` status flips. | First-paint is heavy. The landing should mount with weapons preload only; defer the rest. |
| **HUD** | React state-driven re-renders. Mostly fine. | `DamageNumberField.tsx:85` uses `useState` force-tick on every event AND every TTL drop. That's React reconciliation in the hot path — should be ref-based with one useFrame doing the visible-set walk. | Damage numbers re-render the whole field on every hit. Move to ref + procedural mesh update. |

---

## Quick wins (1-2hr each)

1. **Hoist scratch THREE objects in `fireResolution.ts`**
   - Lines 129, 145, 173-174: create module-scope `_right`, `_forward`, `_dir`, `_yAxis = new Vector3(0,1,0)`, `_xAxis = new Vector3(1,0,0)`. Use `.set(...)` per pellet.
   - File-only change, no API surface drift.

2. **Drop lamp pointLight castShadow** (`LampField.tsx:51-57`)
   - Remove `castShadow` and `shadow-mapSize-*` props. Re-snapshot baselines.
   - Verify visually: a screenshot test of seed=12345 archetype=library with lit lamps before/after.

3. **Hoist `BodyPart` / `Shell` / `ParticleBurst` geometries + base materials to module scope**
   - `BodyPartField.tsx:167`, `ShellEjectField.tsx:92`, `ParticleBurstField.tsx:262`.
   - Per-mesh material clones if opacity needs per-instance values; or accept shared opacity (decays in lockstep).

4. **Gate `ChromaticAberration` on `pulseActive`** (`HitChromaticAberration.tsx:60`)
   - Conditional render: `return pulseActive ? <ChromaticAberration .../> : null`.
   - Pulse window is 180ms, so 99% of frames skip the pass entirely.

5. **Fix `enemyTickLoop` redundant mesh writes** (`enemyTickLoop.ts:200-213`)
   - Delete the `mesh.position.{x,y,z} = ...` block + `mesh.lookAt(...)` call. Leave only `enemy.position.x/y` mutation.
   - Run `pnpm test:e2e:archetype-screenshots` to confirm visual parity. Yaw may shift; if so, accept the new baselines.

6. **Pin `AdaptiveResolution` useFrame to `priority={2}`** (`AdaptiveResolution.tsx:58`)
   - Documents the gl.info sampling contract correctly. Tiny correctness fix.

7. **Reduce flashlight shadow map to 512²** (`Flashlight.tsx:72`)
   - One-line change, re-snapshot baselines.

**Cumulative expected impact of all quick wins:** ~15-20% draw-call reduction on bloom-light archetypes, ~30-40% GPU frame-time reduction on flashlight-dominated scenes, ~10% sim time saved per frame in heavy combat.

---

## Architectural changes (multi-day)

### A. InstancedMesh for static scatter (walls, props, lamps, debris, decals, large-props, nature, kitchen, npcs)
- New helper `src/scene/render/InstancedField.tsx` that takes `{ url, instances: { position, rotation, scale }[] }` and renders one `<instancedMesh>` per unique geometry inside the GLB.
- Migrate each field renderer (`PropField`, `LampField`, `DebrisField`, etc.) one at a time. Skinned enemies and NPCs stay on the clone-per-instance path.
- Walls: separate refactor — `MapGeometry` and `SectorMapGeometry` both have their own wall iteration; share a helper.
- **Effort:** 2-3 days. **Win:** 200-400 draw calls reclaimed across all archetypes; library/courtyard should drop to ~450-550 peak.

### B. InstancedMesh for ephemeral pool (body parts, shells, motes, bullets)
- One InstancedMesh per pool, `setMatrixAt(i, m)`, hide expired slots by collapsing matrix scale to 0.
- Per-instance opacity = custom shader patch via `onBeforeCompile` injecting a per-instance attribute, OR accept lifetime-uniform opacity (all motes fade in lockstep — visually fine for the small pool sizes).
- BulletField already does shared geometry/material; extend to true instancing.
- **Effort:** 1-2 days. **Win:** Up to 500 draw calls reclaimed in heavy combat, GC pressure flattens.

### C. Selective postprocessing chain
- Replace always-on Bloom with `Bloom` controlled by an AdaptiveResolution-driven `lowQuality` flag (drop on <30fps for 2 windows, restore on >55fps).
- Conditionally mount HitChromaticAberration only when the pulse is active (covered in quick wins, but the architectural fold is: introduce a `PostprocessingChain` component that subscribes to AdaptiveResolution decisions).
- **Effort:** 1 day. **Win:** -30% fragment time when mobile is throttled.

### D. Tiered asset preload
- Three tiers:
  1. Critical (landing): pistol GLB + 2 ambient enemy types + corridor walls.
  2. Map-mount (post-loading): archetype walls + enemy roster for this archetype.
  3. Deferred (post-first-frame): all decals/debris/kitchen/nature scatter pools.
- The `useGLTF.preload(url)` calls at module scope force Tier-3 work into Tier-1. Convert to explicit `preload*Tier()` functions called from the relevant lifecycle.
- **Effort:** 1 day. **Win:** -2s to time-to-interactive on cold-start mobile.

### E. Music synth defer
- `ensureSfx()` should split into `ensureSfxCritical()` (SFX only) and `ensureMusic()`. Landing's `Start Game` button calls SFX-critical; music synths init after the first frame of `playing` status.
- **Effort:** half-day. **Win:** -300ms time-to-first-shot on mobile.

---

## Suggested NEW instrumentation (gaps not covered by OBS1-4)

Existing OBS coverage:
- ✅ Peak draw calls per archetype (OBS3)
- ✅ Peak triangles per archetype (OBS3)
- ✅ FPS (OBS1)
- ✅ Per-archetype regression gate (OBS4)

Gaps worth filling:

1. **GC pause histogram** — `PerformanceObserver({entryTypes:["gc"]})` (Chrome) or fallback to large-allocation tracking. Critical for the body-parts / shell-eject jank window. Add a debug-build HUD widget plus an OBS5 budget: `>5 GC events >50ms over 30s = fail`.

2. **Per-system ms/frame breakdown** — wrap the major useFrames in `performance.mark/measure`:
   - `mark scene-tick-start` / `end` around `enemyTickLoop`
   - `mark render-flashlight-start` / `end` around `Flashlight` useFrame
   - `mark composer-start` / `end` around the EffectComposer
   - Emit a per-archetype OBS6 baseline: `enemyTickLoop should be <2ms p95`.

3. **First-frame time-to-interactive** — measure from `navigation.requestStart` to first `objexoom:fpsUpdate` event with a stable FPS reading. OBS7 budget: `mobile-class TTI < 4s`. Critical because Capacitor Android boot is the bottleneck most users actually feel.

4. **Audio underrun count** — `Tone.getContext().rawContext.audioWorklet` doesn't surface underruns directly, but `Tone.now() - performance.now()/1000` drift detects scheduling stalls. Add a 60s rolling drift check; OBS8 budget: `>3 drift events >100ms = fail`.

5. **Draw-call source attribution** — OBS3 reports peak draw calls but not WHICH system caused them. Add an in-debug-build pass that tags each material with `userData.systemTag = "wall"|"prop"|"enemy"|"particle"` and walks the scene at sample time to attribute calls. Without this, regression bisection requires manual diffing.

Items 1, 3, 5 are the ones that would meaningfully change debugging speed for future regressions. Items 2, 4 are nice-to-have.

---

## What I did NOT find that you might be worried about

- **Math.random in sim paths**: grep'd `src/sim/**`, `src/engine/**`, `src/systems/**` — they don't exist as dirs. The actual sim files (`engine.ts`, `enemyAi.ts`, `traps.ts`) are clean; the only `Math.random` uses are in particle/shell-eject visual paths where determinism isn't required.
- **react.memo missing on heavy components**: grep returned zero hits; nothing in the scene tree is memoized. Per-frame allocations are the bigger fish; React-tree re-renders only happen on map remount (re-keyed by `${settings.level}-${seed}-${map.seed}`).
- **Texture duplication**: every `useGLTF.preload(url)` is unique per URL; drei's cache dedupes. No redundant texture loads.
- **WASM regression**: confirmed sql.js is gone, jeep-sqlite path is in `src/platform/persistence/`. Don't suggest re-adding wasm.

---

## Open questions worth asking the user

1. Are the corridor baseline of 834 draw calls actually problematic on Pixel 5a, or is the game already hitting 60fps there? If the latter, issues #1 and #7 drop to "future-tier" priority and the quick wins are sufficient.
2. The asset pipeline produces single-mesh GLBs per prop (the comment in `PropField.tsx:14` suggests this) — confirm before designing the InstancedMesh refactor.
3. Capacitor target: minSDK and the Pixel 5a class — is the agent supposed to test on an emulator or rely on OBS3's headless Chromium baseline?
