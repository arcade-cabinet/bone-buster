import { motion } from "framer-motion";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	FONT_FAMILY,
	FONT_WEIGHT,
	LETTER_SPACING,
	OBJEXOOM_PALETTE,
	ROLE,
	SCALE,
} from "./design-tokens";
import { addObjexoomListener, dispatch } from "./events";
import { HUDOverlays } from "./hud/overlays/HUDOverlays";
import type { GameState } from "./ObjexoomShell";
import type { PropArchetype } from "./scatter/propPool";
import { HudKey3D } from "./scene/hud/HudKey3D";
import { type Difficulty, LEVEL_LABEL, type LevelChoice } from "./settings";
import { WEAPON_ORDER, WEAPONS, type WeaponId } from "./weapons";

type ObjexoomHUDProps = Readonly<{
	state: GameState;
	touchMode: boolean;
	onResume: () => void;
	onReturnToLanding: () => void;
	onQuit: () => void;
	onSelectWeapon: (weapon: WeaponId) => void;
	// M5 — current level identity for the top-left HUD readout.
	level: LevelChoice;
	/**
	 * POL7 — current archetype for the top-left readout. Appended to the
	 * level label so the player learns the name (`RANDOM · ARENA`,
	 * `M1 · CORRIDOR`).
	 */
	archetype: PropArchetype;
	// POL31 — chosen difficulty + monotonic run id; threaded through to
	// the DifficultyChip overlay slot which fires its 2s acknowledgment
	// every time runId advances.
	difficulty: Difficulty;
	runId: number;
}>;

export function ObjexoomHUD({
	state,
	touchMode,
	onResume,
	onReturnToLanding,
	onQuit,
	onSelectWeapon,
	level,
	archetype,
	difficulty,
	runId,
}: ObjexoomHUDProps) {
	const currentSpec = WEAPONS[state.weapon];
	const currentAmmo = state.ammo[state.weapon];
	const ammoLabel = Number.isFinite(currentAmmo) ? `${currentAmmo}` : "∞";

	// E10 — track when the HUD key model should flash red. `flashUntil`
	// is a wall-clock deadline; the HudKey3D renderer ramps emissive
	// from amber to blood as long as `now < flashUntil`.
	const [keyFlashUntil, setKeyFlashUntil] = useState(0);
	useEffect(() => {
		return addObjexoomListener("playerHit", () => {
			setKeyFlashUntil(performance.now() + 250);
		});
	}, []);

	return (
		<section
			aria-label="OBJEXOOM heads-up display"
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				fontFamily: FONT_FAMILY.body,
				color: ROLE.textPrimary,
			}}
		>
			{/* AUDIO3 — transient HUD overlays (POL21 secret-found, POL22
			    key-acquired, POL26 going-back klaxon) live in
			    src/hud/overlays/ per docs/SLOT-ARCHITECTURE.md §1.
			    HUDOverlays mounts all four and forwards phase + state. */}
			<HUDOverlays
				phase={state.phase}
				state={state}
				difficulty={difficulty}
				runId={runId}
				onReturnToMenu={onReturnToLanding}
				onResume={onResume}
				onQuit={onQuit}
			/>
			{/* E10 — 3D spinning key model. Mounts only when hasKey is
			    true (no Canvas → no WebGL cost otherwise). Flashes red on
			    player-hit via the keyFlashUntil deadline. */}
			<HudKey3D hasKey={state.hasKey} flashUntil={keyFlashUntil} />
			<div style={cornerStyle("top-left")}>
				{/* M5 — level identity. Hidden on touch (cramped screen real
				    estate) to keep the HP pip row + warning legible. */}
				{!touchMode && (
					<div
						data-testid="objexoom-level"
						style={{
							fontFamily: FONT_FAMILY.display,
							fontSize: "var(--obx-hud-fs-readout, 13px)",
							fontWeight: FONT_WEIGHT.regular,
							letterSpacing: LETTER_SPACING.hudLabel,
							color: ROLE.accentPrimary,
							marginBottom: 8,
							textShadow: `0 0 10px ${ROLE.accentPrimary}66`,
						}}
					>
						{LEVEL_LABEL[level]} <span style={{ opacity: 0.5 }}>·</span>{" "}
						<span style={{ opacity: 0.85 }}>{archetype.toUpperCase()}</span>
					</div>
				)}
				<div style={hudLabelStyle}>HEALTH</div>
				{/* M1 — pip row replaces the continuous bar. Each pip is an
				    amber-emissive square; lit pips track hp 1:1. Below 3 pips
				    we surface a LOW HEALTH warning in red. */}
				<HpPipRow hp={Math.max(0, state.hp)} maxHp={state.maxHp} />
				<div data-testid="objexoom-hp" style={hudReadoutStyle}>
					{Math.max(0, state.hp)} / {state.maxHp}
				</div>
				{state.hp > 0 && state.hp <= 3 && (
					<motion.div
						style={lowHealthWarningStyle}
						animate={{ opacity: [0.5, 1, 0.5] }}
						transition={{ duration: 0.9, repeat: Infinity }}
					>
						LOW HEALTH
					</motion.div>
				)}
			</div>

			<div style={cornerStyle("top-right")}>
				<div style={hudLabelStyle}>KILLS</div>
				<motion.div
					data-testid="objexoom-kills"
					style={{
						fontFamily: FONT_FAMILY.display,
						// BC6 — clamp(18px, 2.4vmin, 24px) — the kill count
						// stays at display-size, biggest readout besides ammo.
						fontSize: "var(--obx-hud-fs-display, 24px)",
						fontWeight: FONT_WEIGHT.regular,
						letterSpacing: LETTER_SPACING.display,
					}}
					key={state.kills}
					initial={{ scale: 1.2 }}
					animate={{ scale: 1 }}
					transition={{ type: "spring", stiffness: 320, damping: 18 }}
				>
					{state.kills} / {state.totalEnemies}
				</motion.div>
				{state.score > 0 && (
					<motion.div
						data-testid="objexoom-score"
						style={{
							marginTop: 4,
							fontFamily: FONT_FAMILY.display,
							fontSize: "var(--obx-hud-fs-readout, 14px)",
							fontWeight: FONT_WEIGHT.regular,
							letterSpacing: LETTER_SPACING.display,
							color: ROLE.actionKey,
						}}
						key={state.score}
						initial={{ scale: 1.4 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 320, damping: 18 }}
					>
						SCORE {state.score}
					</motion.div>
				)}
				{state.run.runTotalSecrets > 0 && (
					<motion.div
						data-testid="objexoom-secrets"
						style={{
							marginTop: 4,
							fontFamily: FONT_FAMILY.display,
							fontSize: "var(--obx-hud-fs-readout, 14px)",
							fontWeight: FONT_WEIGHT.regular,
							letterSpacing: LETTER_SPACING.display,
							color: ROLE.actionKey,
						}}
						key={state.run.runTotalSecrets}
						initial={{ scale: 1.4 }}
						animate={{ scale: 1 }}
						transition={{ type: "spring", stiffness: 320, damping: 18 }}
					>
						SECRETS {state.run.runTotalSecrets}
					</motion.div>
				)}
				<div
					data-testid="objexoom-key"
					style={{
						marginTop: 6,
						fontSize: "var(--obx-hud-fs-label, 11px)",
						letterSpacing: LETTER_SPACING.hudLabel,
						color: state.hasKey ? ROLE.actionKey : ROLE.textPrimary,
					}}
				>
					{state.hasKey ? "KEY ACQUIRED" : "FIND THE KEY"}
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					bottom: touchMode ? undefined : "calc(18px + var(--obx-safe-bottom, 0px))",
					top: touchMode ? "calc(90px + var(--obx-safe-top, 0px))" : undefined,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					gap: 8,
					alignItems: "center",
					padding: "6px 10px",
					background: ROLE.bgPanelAlpha,
					borderRadius: 14,
					pointerEvents: touchMode ? "auto" : "none",
				}}
			>
				{WEAPON_ORDER.map((id) => {
					const owned = state.ownedWeapons[id];
					const active = state.weapon === id;
					const spec = WEAPONS[id];
					return (
						<button
							key={id}
							type="button"
							disabled={!owned}
							onPointerDown={(e) => {
								if (!touchMode) return;
								e.preventDefault();
								onSelectWeapon(id);
							}}
							onClick={() => {
								if (touchMode) return;
								onSelectWeapon(id);
							}}
							style={weaponChipStyle(active, owned, spec.muzzleColor)}
							aria-label={`Select ${spec.label}`}
							aria-pressed={active}
						>
							<span style={{ fontSize: "var(--obx-hud-fs-label, 10px)", opacity: 0.7 }}>
								{spec.hudHotkey}
							</span>{" "}
							{spec.label}
						</button>
					);
				})}
			</div>

			<div
				style={{
					position: "absolute",
					bottom: touchMode
						? `calc(${STICK_RADIUS * 2 + 24}px + var(--obx-safe-bottom, 0px))`
						: "calc(50px + var(--obx-safe-bottom, 0px))",
					left: "50%",
					transform: "translateX(-50%)",
					padding: "8px 16px",
					background: ROLE.bgPanelAlpha,
					borderRadius: 12,
					fontFamily: FONT_FAMILY.display,
					fontWeight: FONT_WEIGHT.regular,
					// BC6 — clamp(18px, 2.4vmin, 24px) — the big ammo readout
					// stays the biggest HUD number even on small viewports
					fontSize: "var(--obx-hud-fs-display, 22px)",
					letterSpacing: LETTER_SPACING.display,
					color: currentSpec.muzzleColor,
				}}
			>
				{ammoLabel}
			</div>

			<div style={crosshairStyle} />

			{state.status === "playing" && touchMode && <TouchControls />}

			{/* PT4A — prepend movement hint so a new player who clicks
			    NEW GAME doesn't stand still wondering how to walk. */}
			{state.status === "playing" && !touchMode && (
				<div style={hintStyle}>
					WASD TO MOVE · MOUSE TO LOOK · LMB TO FIRE · 1-5 OR SCROLL TO SWAP · ESC TO PAUSE
				</div>
			)}

			{/* M4 — "Click to engage" prompt when in playing state but pointer
			    isn't locked (covers first-load + any moment the user has the
			    cursor free). Hidden on touch (no pointer-lock concept). */}
			{state.status === "playing" && !touchMode && <ClickToEngagePrompt />}

			{/* POL34 — `paused` state moved to the PauseOverlay HUD slot
			    (src/hud/overlays/PauseOverlay.tsx). The slot owns its
			    own AnimatePresence wrapper so we don't gate on
			    status !== "playing" here for paused. */}
			{(state.status === "dead" || state.status === "transitioning") && (
				<div style={overlayStyle}>
					{state.status === "dead" && (
						<OverlayCard
							title="YOU DIED"
							body={formatRunStats(state)}
							primary={{ label: "TRY AGAIN", onClick: onReturnToLanding }}
							secondary={{ label: "QUIT", onClick: onQuit }}
						/>
					)}
					{/* PT1B — MISSION COMPLETE is now owned by the
					    MissionCompleteCeremony HUD overlay slot. The
					    generic OverlayCard isn't celebratory enough for
					    a campaign-clear; the dedicated slot adds tick-up
					    stats, layered vignette, and spring-eased CTA. */}
					{state.status === "transitioning" && (
						<OverlayCard
							title="LEVEL COMPLETE"
							body={`ADVANCING TO M${state.run.runLevelsCleared + 1}\n\n${formatRunStats(state)}`}
						/>
					)}
				</div>
			)}
			<AdaptiveResolutionReadout />
		</section>
	);
}

// E12/PA16 — only mounts when ?objexoomDebug is in the URL. Listens to
// the `objexoom:fpsUpdate` event dispatched from inside the Canvas and
// renders a tiny FPS + DPR readout in the bottom-left corner.
// OBS2 — perf budget thresholds. If draw-calls or triangles
// exceed these for 3 consecutive report windows, the readout
// border flashes red + a one-shot console warning fires.
const OBS2_CALL_BUDGET = 400;
const OBS2_TRI_BUDGET = 50_000;
const OBS2_CONSECUTIVE_WINDOWS = 3;

function AdaptiveResolutionReadout() {
	const [info, setInfo] = useState<{
		fps: number;
		pixelRatio: number;
		drawCalls?: number;
		triangles?: number;
	} | null>(null);
	const [overBudget, setOverBudget] = useState(false);
	const consecutiveOverRef = useRef(0);
	const warnedRef = useRef(false);
	const [enabled] = useState(
		() =>
			typeof window !== "undefined" &&
			new URLSearchParams(window.location.search).has("objexoomDebug"),
	);

	useEffect(() => {
		if (!enabled) return;
		return addObjexoomListener("fpsUpdate", ({ fps, pixelRatio, drawCalls, triangles }) => {
			setInfo({ fps, pixelRatio, drawCalls, triangles });
			// OBS2 — accumulate consecutive over-budget windows.
			const overCalls = drawCalls != null && drawCalls > OBS2_CALL_BUDGET;
			const overTris = triangles != null && triangles > OBS2_TRI_BUDGET;
			if (overCalls || overTris) {
				consecutiveOverRef.current += 1;
				if (consecutiveOverRef.current >= OBS2_CONSECUTIVE_WINDOWS) {
					setOverBudget(true);
					if (!warnedRef.current) {
						warnedRef.current = true;
						console.warn(
							`[OBS2] perf-budget exceeded for ${OBS2_CONSECUTIVE_WINDOWS} consecutive windows: ` +
								`calls=${drawCalls ?? "?"} (budget ${OBS2_CALL_BUDGET}), ` +
								`triangles=${triangles ?? "?"} (budget ${OBS2_TRI_BUDGET})`,
						);
					}
				}
			} else {
				consecutiveOverRef.current = 0;
				setOverBudget(false);
			}
		});
	}, [enabled]);

	if (!enabled || !info) return null;
	const triFmt = (n: number | undefined) => {
		if (n == null) return "";
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return String(n);
	};
	const borderColor = overBudget ? "#ef4444" : `${ROLE.accentPrimary}55`;
	const textColor = overBudget ? "#fca5a5" : ROLE.accentPrimary;
	return (
		<div
			data-testid="objexoom-fps-readout"
			style={{
				position: "absolute",
				left: "calc(12px + var(--obx-safe-left, 0px))",
				bottom: "calc(12px + var(--obx-safe-bottom, 0px))",
				fontFamily: FONT_FAMILY.body,
				// BC6 — clamp(10px, 1.2vmin, 13px) declared in app/tokens.css
				fontSize: "var(--obx-hud-fs-hint, 11px)",
				letterSpacing: LETTER_SPACING.hudLabel,
				color: textColor,
				background: `${OBJEXOOM_PALETTE.ink}cc`,
				padding: "4px 8px",
				borderRadius: 4,
				border: `1px solid ${borderColor}`,
				pointerEvents: "none",
				display: "flex",
				flexDirection: "column",
				gap: 2,
				lineHeight: 1.2,
			}}
		>
			<div>
				FPS {info.fps.toFixed(0)} • DPR {info.pixelRatio.toFixed(2)}
			</div>
			{(info.drawCalls != null || info.triangles != null) && (
				<div style={{ opacity: 0.85 }}>
					{info.drawCalls != null && <>CALLS {info.drawCalls}</>}
					{info.drawCalls != null && info.triangles != null && <> • </>}
					{info.triangles != null && <>TRIS {triFmt(info.triangles)}</>}
				</div>
			)}
		</div>
	);
}

function formatRunStats(state: GameState): string {
	const elapsedMs = Math.max(0, performance.now() - state.run.runStartAt);
	const total = Math.round(elapsedMs / 1000);
	const min = Math.floor(total / 60);
	const sec = total % 60;
	const time = `${min}:${String(sec).padStart(2, "0")}`;
	const kills = state.run.runTotalKills;
	const dmg = state.run.runTotalDamageTaken;
	const cleared = state.run.runLevelsCleared;
	const score = state.run.runTotalScore;
	const scoreSegment = score > 0 ? `  •  ${score} SCORE` : "";
	const secrets = state.run.runTotalSecrets;
	const secretsSegment = secrets > 0 ? `  •  ${secrets} SECRET${secrets === 1 ? "" : "S"}` : "";
	return `${cleared} LEVEL${cleared === 1 ? "" : "S"} CLEARED  •  TIME ${time}  •  ${kills} KILLS  •  ${dmg} DMG TAKEN${scoreSegment}${secretsSegment}`;
}

const STICK_RADIUS = 56;
const STICK_KNOB = 28;

function TouchControls() {
	return (
		<>
			<VirtualStick channel="move" anchor="left" ariaLabel="Move" />
			<VirtualStick channel="look" anchor="right" ariaLabel="Aim" />
			<FireButton />
		</>
	);
}

function VirtualStick({
	channel,
	anchor,
	ariaLabel,
}: {
	channel: "move" | "look";
	anchor: "left" | "right";
	ariaLabel: string;
}) {
	const [knob, setKnob] = useState({ x: 0, y: 0 });
	const pointerId = useRef<number | null>(null);
	const baseCenter = useRef<{ x: number; y: number } | null>(null);

	const dispatchStick = useCallback(
		(x: number, y: number) => {
			dispatch({ type: channel, x, y });
		},
		[channel],
	);

	const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (pointerId.current !== null) return;
		pointerId.current = e.pointerId;
		(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
		const rect = e.currentTarget.getBoundingClientRect();
		baseCenter.current = {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		};
	};
	const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.pointerId !== pointerId.current || !baseCenter.current) return;
		const dx = e.clientX - baseCenter.current.x;
		const dy = e.clientY - baseCenter.current.y;
		const mag = Math.hypot(dx, dy);
		const clamped = Math.min(mag, STICK_RADIUS);
		const nx = mag === 0 ? 0 : (dx / mag) * clamped;
		const ny = mag === 0 ? 0 : (dy / mag) * clamped;
		setKnob({ x: nx, y: ny });
		dispatchStick(nx / STICK_RADIUS, ny / STICK_RADIUS);
	};
	const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.pointerId !== pointerId.current) return;
		pointerId.current = null;
		baseCenter.current = null;
		setKnob({ x: 0, y: 0 });
		dispatchStick(0, 0);
	};

	return (
		<div
			role="slider"
			aria-label={ariaLabel}
			aria-valuemin={-1}
			aria-valuemax={1}
			aria-valuenow={0}
			tabIndex={-1}
			onPointerDown={onDown}
			onPointerMove={onMove}
			onPointerUp={onUp}
			onPointerCancel={onUp}
			style={{
				position: "absolute",
				bottom: "calc(24px + var(--obx-safe-bottom, 0px))",
				left: anchor === "left" ? "calc(24px + var(--obx-safe-left, 0px))" : undefined,
				right: anchor === "right" ? "calc(24px + var(--obx-safe-right, 0px))" : undefined,
				width: STICK_RADIUS * 2,
				height: STICK_RADIUS * 2,
				borderRadius: "50%",
				background: ROLE.bgPanelAlpha,
				border: `1px solid ${ROLE.accentPrimary}55`,
				pointerEvents: "auto",
				touchAction: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					width: STICK_KNOB,
					height: STICK_KNOB,
					marginLeft: -STICK_KNOB / 2,
					marginTop: -STICK_KNOB / 2,
					borderRadius: "50%",
					background: ROLE.heroGradientCool,
					transform: `translate(${knob.x}px, ${knob.y}px)`,
					transition: pointerId.current === null ? "transform 120ms ease-out" : "none",
				}}
			/>
		</div>
	);
}

function FireButton() {
	const fire = useCallback(() => {
		dispatch({ type: "fire" });
	}, []);
	return (
		<button
			type="button"
			aria-label="Fire"
			onPointerDown={(e) => {
				e.preventDefault();
				fire();
			}}
			style={{
				position: "absolute",
				right: "calc(24px + var(--obx-safe-right, 0px))",
				bottom: `calc(${STICK_RADIUS * 2 + 48}px + var(--obx-safe-bottom, 0px))`,
				width: 72,
				height: 72,
				borderRadius: "50%",
				border: "none",
				background: ROLE.heroGradientHot,
				color: ROLE.textHighContrast,
				fontFamily: FONT_FAMILY.display,
				fontWeight: FONT_WEIGHT.regular,
				fontSize: 14,
				letterSpacing: LETTER_SPACING.display,
				pointerEvents: "auto",
				touchAction: "none",
				boxShadow: `0 8px 24px ${ROLE.accentPrimary}73`,
			}}
		>
			FIRE
		</button>
	);
}

type OverlayAction = { label: string; onClick: () => void };

function OverlayCard({
	title,
	body,
	primary,
	secondary,
	tertiary,
}: Readonly<{
	title: string;
	body: string;
	primary?: OverlayAction;
	secondary?: OverlayAction;
	tertiary?: OverlayAction;
}>) {
	return (
		<motion.div
			style={cardStyle}
			initial={{ y: 20, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			transition={{ type: "spring", stiffness: 280, damping: 24 }}
		>
			<h1 style={overlayTitleStyle}>{title}</h1>
			{body && <p style={{ marginTop: 12, maxWidth: 360, lineHeight: 1.4 }}>{body}</p>}
			<div
				style={{
					display: "flex",
					gap: 12,
					marginTop: 20,
					flexWrap: "wrap",
					justifyContent: "center",
				}}
			>
				{primary && (
					<button
						type="button"
						onClick={primary.onClick}
						style={ctaButton(OBJEXOOM_PALETTE.amber, true)}
					>
						{primary.label}
					</button>
				)}
				{secondary && (
					<button type="button" onClick={secondary.onClick} style={ctaButton("transparent", false)}>
						{secondary.label}
					</button>
				)}
				{tertiary && (
					<button type="button" onClick={tertiary.onClick} style={ctaButton("transparent", false)}>
						{tertiary.label}
					</button>
				)}
			</div>
		</motion.div>
	);
}

// BC4 — every viewport-edge anchor adds the matching `--obx-safe-*`
// inset (declared in app/tokens.css). On desktop the env() falls back
// to 0px and the HUD looks identical; on foldables / notched phones /
// status-bar overlays the chip slides clear of the cutout instead of
// being clipped by it.
const cornerStyle = (corner: "top-left" | "top-right"): CSSProperties => ({
	position: "absolute",
	top: "calc(16px + var(--obx-safe-top, 0px))",
	left: corner === "top-left" ? "calc(16px + var(--obx-safe-left, 0px))" : undefined,
	right: corner === "top-right" ? "calc(16px + var(--obx-safe-right, 0px))" : undefined,
	padding: "10px 14px",
	background: ROLE.bgPanelAlpha,
	borderRadius: 12,
	backdropFilter: "blur(6px)",
	minWidth: 140,
});

const hudLabelStyle: CSSProperties = {
	fontFamily: FONT_FAMILY.body,
	// BC6 — clamp(9px, 1.05vmin, 11px) declared in app/tokens.css
	fontSize: "var(--obx-hud-fs-label, 10px)",
	fontWeight: FONT_WEIGHT.semibold,
	letterSpacing: LETTER_SPACING.hudLabel,
	opacity: 0.8,
	marginBottom: 4,
};

const hudReadoutStyle: CSSProperties = {
	fontFamily: FONT_FAMILY.display,
	// BC6 — clamp(12px, 1.45vmin, 15px) declared in app/tokens.css
	fontSize: "var(--obx-hud-fs-readout, 13px)",
	marginTop: 4,
	letterSpacing: LETTER_SPACING.display,
};

const crosshairStyle: CSSProperties = {
	position: "absolute",
	top: "50%",
	left: "50%",
	width: 6,
	height: 6,
	transform: "translate(-50%, -50%)",
	borderRadius: "50%",
	background: ROLE.accentCool,
	boxShadow: `0 0 0 2px ${ROLE.accentPrimary}`,
};

const hintStyle: CSSProperties = {
	position: "absolute",
	bottom: "calc(18px + var(--obx-safe-bottom, 0px))",
	left: "50%",
	transform: "translateX(-50%)",
	// BC6 — clamp(10px, 1.2vmin, 13px) declared in app/tokens.css
	fontSize: "var(--obx-hud-fs-hint, 11px)",
	letterSpacing: LETTER_SPACING.hudLabel,
	opacity: 0.6,
	whiteSpace: "nowrap",
};

const overlayStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	display: "grid",
	placeItems: "center",
	// scale-step: overlay scrim wants the deepest-ink available (ink[950]) at
	// ~78% alpha — there is no semantic ROLE for "modal scrim" yet.
	background: `${SCALE.ink[950]}c7`,
	pointerEvents: "auto",
	padding: 24,
	textAlign: "center",
};

const cardStyle: CSSProperties = {
	background: ROLE.bgPanel,
	border: `1px solid ${ROLE.borderSoft}`,
	borderRadius: 16,
	padding: 36,
	color: ROLE.textPrimary,
	textAlign: "center",
};

const overlayTitleStyle: CSSProperties = {
	fontFamily: FONT_FAMILY.display,
	fontWeight: FONT_WEIGHT.regular,
	letterSpacing: LETTER_SPACING.display,
	fontSize: "clamp(40px, 7vw, 72px)",
	margin: 0,
	background: ROLE.wordmarkGradient,
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	lineHeight: 0.95,
};

function ctaButton(bg: string, primary: boolean): CSSProperties {
	return {
		padding: "12px 22px",
		borderRadius: 10,
		border: primary ? "none" : `1px solid ${ROLE.borderSoft}`,
		background: bg,
		color: primary ? OBJEXOOM_PALETTE.ink : ROLE.textPrimary,
		fontFamily: FONT_FAMILY.display,
		fontWeight: FONT_WEIGHT.regular,
		fontSize: 14,
		letterSpacing: LETTER_SPACING.hudLabel,
		cursor: "pointer",
	};
}

function weaponChipStyle(active: boolean, owned: boolean, accent: string): CSSProperties {
	return {
		padding: "6px 10px",
		borderRadius: 10,
		fontFamily: FONT_FAMILY.body,
		// BC6 — clamp(9px, 1.05vmin, 11px) — weapon-chip text stays a
		// notch smaller than the corner readouts so the strip is the
		// quieter element of the bottom band.
		fontSize: "var(--obx-hud-fs-label, 11px)",
		fontWeight: FONT_WEIGHT.semibold,
		letterSpacing: LETTER_SPACING.hudChip,
		border: active ? `1px solid ${accent}` : "1px solid transparent",
		background: active
			? `${accent}22`
			: owned
				? // scale-step: weapon-row backgrounds use highest-contrast
					// parchment (50) at tiny alpha (0d/05) for a subtle off-state
					// fill — no semantic ROLE captures "weapon-slot row tint".
					`${SCALE.parchment[50]}0d`
				: `${SCALE.parchment[50]}05`,
		color: owned ? ROLE.textPrimary : ROLE.textMuted,
		opacity: owned ? 1 : 0.5,
		cursor: owned ? "pointer" : "not-allowed",
		pointerEvents: "auto",
	};
}

// M1 — HP pip row. Renders one square per HP point; lit pips track the
// current hp, dimmed pips fill the rest of the bar up to maxHp. Each
// pip is 14×14 amber-emissive when lit, dark muted-violet when not.
function HpPipRow({ hp, maxHp }: { hp: number; maxHp: number }) {
	const pips: number[] = [];
	for (let i = 0; i < maxHp; i += 1) pips.push(i);
	return (
		// biome-ignore lint/a11y/useSemanticElements: custom pip-based HP display, not a native meter
		<div
			data-testid="objexoom-hp-pips"
			role="meter"
			aria-valuenow={hp}
			aria-valuemax={maxHp}
			aria-valuemin={0}
			style={{
				display: "flex",
				gap: 3,
				flexWrap: "wrap",
				maxWidth: 220,
				marginTop: 4,
				marginBottom: 2,
			}}
		>
			{pips.map((i) => {
				const lit = i < hp;
				return (
					<div
						key={i}
						style={{
							width: 14,
							height: 14,
							borderRadius: 3,
							background: lit ? ROLE.actionKey : `${SCALE.violet[300]}2e`,
							boxShadow: lit
								? `0 0 6px ${ROLE.actionKey}aa`
								: `inset 0 0 0 1px ${SCALE.parchment[50]}0f`,
						}}
					/>
				);
			})}
		</div>
	);
}

const lowHealthWarningStyle: CSSProperties = {
	marginTop: 4,
	fontFamily: FONT_FAMILY.display,
	fontSize: 11,
	fontWeight: FONT_WEIGHT.regular,
	letterSpacing: LETTER_SPACING.hudLabel,
	color: ROLE.actionHurt,
	textShadow: `0 0 6px ${ROLE.actionDamage}73`,
};

// M4 — "Click to engage" prompt. Watches document.pointerLockElement
// and surfaces a centered call-to-action whenever the player is in
// playing state but the canvas hasn't captured pointer-lock. This
// covers the first canvas click (first-load gesture requirement) and
// any moment the lock breaks (alt-tab, OS focus shift, etc).
function ClickToEngagePrompt() {
	const [locked, setLocked] = useState(
		typeof document !== "undefined" ? document.pointerLockElement != null : false,
	);
	useEffect(() => {
		const onChange = () => setLocked(document.pointerLockElement != null);
		document.addEventListener("pointerlockchange", onChange);
		// Also poll once a second in case the browser silently breaks lock
		// without firing the event (some Firefox / iframe edge cases).
		const id = window.setInterval(onChange, 1000);
		return () => {
			document.removeEventListener("pointerlockchange", onChange);
			window.clearInterval(id);
		};
	}, []);
	// PT1A — debug/playtest runs (`?objexoomDebug`) drive the game via
	// `window.__objexoom.*` and can't acquire pointer-lock without a real
	// user gesture. The prompt is for human players; debug runs already
	// drive input through the hook contract, so hide the overlay so
	// scripted screenshot captures see the real gameplay framing.
	const debug =
		typeof window !== "undefined" &&
		new URL(window.location.href).searchParams.has("objexoomDebug");
	if (locked || debug) return null;
	return (
		<div
			data-testid="objexoom-click-to-engage"
			style={{
				position: "absolute",
				inset: 0,
				display: "grid",
				placeItems: "center",
				pointerEvents: "none",
			}}
		>
			<motion.div
				animate={{ opacity: [0.4, 0.9, 0.4] }}
				transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
				style={{
					padding: "14px 24px",
					background: `${SCALE.ink[950]}b3`,
					borderRadius: 14,
					border: `1px solid ${ROLE.accentPrimary}55`,
					fontFamily: FONT_FAMILY.display,
					fontWeight: FONT_WEIGHT.regular,
					letterSpacing: LETTER_SPACING.hudLabel,
					fontSize: 13,
					color: ROLE.textPrimary,
					textShadow: `0 0 8px ${ROLE.accentPrimary}88`,
				}}
			>
				CLICK TO ENGAGE — ESC RELEASES MOUSE
			</motion.div>
		</div>
	);
}
