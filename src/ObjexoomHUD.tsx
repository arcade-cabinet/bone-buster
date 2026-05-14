"use client";

import { motion } from "framer-motion";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OBJEXOOM_PALETTE } from "./constants";
import type { GameState } from "./ObjexoomShell";
import { LEVEL_LABEL, type LevelChoice } from "./settings";
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
}>;

export function ObjexoomHUD({
	state,
	touchMode,
	onResume,
	onReturnToLanding,
	onQuit,
	onSelectWeapon,
	level,
}: ObjexoomHUDProps) {
	const currentSpec = WEAPONS[state.weapon];
	const currentAmmo = state.ammo[state.weapon];
	const ammoLabel = Number.isFinite(currentAmmo) ? `${currentAmmo}` : "∞";

	return (
		<section
			aria-label="OBJEXOOM heads-up display"
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				fontFamily: '"Inter", system-ui, sans-serif',
				color: OBJEXOOM_PALETTE.parchment,
			}}
		>
			<div style={cornerStyle("top-left")}>
				{/* M5 — level identity. Hidden on touch (cramped screen real
				    estate) to keep the HP pip row + warning legible. */}
				{!touchMode && (
					<div
						data-testid="objexoom-level"
						style={{
							fontSize: 13,
							fontWeight: 700,
							letterSpacing: "0.18em",
							color: OBJEXOOM_PALETTE.violet,
							marginBottom: 8,
							textShadow: `0 0 10px ${OBJEXOOM_PALETTE.violet}66`,
						}}
					>
						{LEVEL_LABEL[level]}
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
					style={{ fontSize: 22, fontWeight: 700 }}
					key={state.kills}
					initial={{ scale: 1.2 }}
					animate={{ scale: 1 }}
					transition={{ type: "spring", stiffness: 320, damping: 18 }}
				>
					{state.kills} / {state.totalEnemies}
				</motion.div>
				<div
					data-testid="objexoom-key"
					style={{
						marginTop: 6,
						fontSize: 11,
						letterSpacing: "0.18em",
						color: state.hasKey ? OBJEXOOM_PALETTE.amber : OBJEXOOM_PALETTE.parchment,
					}}
				>
					{state.hasKey ? "KEY ACQUIRED" : "FIND THE KEY"}
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					bottom: touchMode ? undefined : 18,
					top: touchMode ? 90 : undefined,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					gap: 8,
					alignItems: "center",
					padding: "6px 10px",
					background: "rgba(6, 9, 18, 0.55)",
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
							<span style={{ fontSize: 10, opacity: 0.7 }}>{spec.hudHotkey}</span> {spec.label}
						</button>
					);
				})}
			</div>

			<div
				style={{
					position: "absolute",
					bottom: touchMode ? STICK_RADIUS * 2 + 24 : 50,
					left: "50%",
					transform: "translateX(-50%)",
					padding: "8px 16px",
					background: "rgba(6, 9, 18, 0.65)",
					borderRadius: 12,
					fontFamily: '"Poppins", system-ui, sans-serif',
					fontWeight: 700,
					fontSize: 22,
					letterSpacing: "0.05em",
					color: currentSpec.muzzleColor,
				}}
			>
				{ammoLabel}
			</div>

			<div style={crosshairStyle} />

			{state.status === "playing" && touchMode && <TouchControls />}

			{state.status === "playing" && !touchMode && (
				<div style={hintStyle}>ESC TO PAUSE · 1/2/3 OR SCROLL TO SWAP · LMB TO FIRE</div>
			)}

			{/* M4 — "Click to engage" prompt when in playing state but pointer
			    isn't locked (covers first-load + any moment the user has the
			    cursor free). Hidden on touch (no pointer-lock concept). */}
			{state.status === "playing" && !touchMode && <ClickToEngagePrompt />}

			{state.status !== "playing" && (
				<div style={overlayStyle}>
					{state.status === "paused" && (
						<OverlayCard
							title="PAUSED"
							body={`The corridors will wait.\n\n${formatRunStats(state)}`}
							primary={{ label: "RESUME", onClick: onResume }}
							secondary={{ label: "MAIN MENU", onClick: onReturnToLanding }}
							tertiary={{ label: "QUIT", onClick: onQuit }}
						/>
					)}
					{state.status === "dead" && (
						<OverlayCard
							title="YOU DIED"
							body=""
							primary={{ label: "TRY AGAIN", onClick: onReturnToLanding }}
							secondary={{ label: "QUIT", onClick: onQuit }}
						/>
					)}
					{state.status === "won" && (
						<OverlayCard
							title="MISSION COMPLETE"
							body={formatRunStats(state)}
							primary={{ label: "NEXT RUN", onClick: onReturnToLanding }}
							secondary={{ label: "QUIT", onClick: onQuit }}
						/>
					)}
					{state.status === "transitioning" && (
						<OverlayCard
							title="LEVEL COMPLETE"
							body={`ADVANCING TO M${state.run.runLevelsCleared + 1}`}
						/>
					)}
				</div>
			)}
		</section>
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
	return `${cleared} LEVEL${cleared === 1 ? "" : "S"} CLEARED  •  TIME ${time}  •  ${kills} KILLS  •  ${dmg} DMG TAKEN`;
}

const STICK_RADIUS = 56;
const STICK_KNOB = 28;

function TouchControls() {
	return (
		<>
			<VirtualStick channel="objexoom:move" anchor="left" ariaLabel="Move" />
			<VirtualStick channel="objexoom:look" anchor="right" ariaLabel="Aim" />
			<FireButton />
		</>
	);
}

function VirtualStick({
	channel,
	anchor,
	ariaLabel,
}: {
	channel: "objexoom:move" | "objexoom:look";
	anchor: "left" | "right";
	ariaLabel: string;
}) {
	const [knob, setKnob] = useState({ x: 0, y: 0 });
	const pointerId = useRef<number | null>(null);
	const baseCenter = useRef<{ x: number; y: number } | null>(null);

	const dispatch = useCallback(
		(x: number, y: number) => {
			window.dispatchEvent(new CustomEvent(channel, { detail: { x, y } }));
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
		dispatch(nx / STICK_RADIUS, ny / STICK_RADIUS);
	};
	const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.pointerId !== pointerId.current) return;
		pointerId.current = null;
		baseCenter.current = null;
		setKnob({ x: 0, y: 0 });
		dispatch(0, 0);
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
				bottom: 24,
				left: anchor === "left" ? 24 : undefined,
				right: anchor === "right" ? 24 : undefined,
				width: STICK_RADIUS * 2,
				height: STICK_RADIUS * 2,
				borderRadius: "50%",
				background: "rgba(6, 9, 18, 0.45)",
				border: `1px solid ${OBJEXOOM_PALETTE.violet}55`,
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
					background: `linear-gradient(135deg, ${OBJEXOOM_PALETTE.indigo}, ${OBJEXOOM_PALETTE.violet})`,
					transform: `translate(${knob.x}px, ${knob.y}px)`,
					transition: pointerId.current === null ? "transform 120ms ease-out" : "none",
				}}
			/>
		</div>
	);
}

function FireButton() {
	const fire = useCallback(() => {
		window.dispatchEvent(new CustomEvent("objexoom:fire"));
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
				right: 24,
				bottom: STICK_RADIUS * 2 + 48,
				width: 72,
				height: 72,
				borderRadius: "50%",
				border: "none",
				background: `linear-gradient(135deg, ${OBJEXOOM_PALETTE.violet}, ${OBJEXOOM_PALETTE.amber})`,
				color: OBJEXOOM_PALETTE.parchment,
				fontFamily: '"Poppins", system-ui, sans-serif',
				fontWeight: 700,
				fontSize: 14,
				letterSpacing: "0.05em",
				pointerEvents: "auto",
				touchAction: "none",
				boxShadow: "0 8px 24px rgba(168,85,247,0.45)",
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

const cornerStyle = (corner: "top-left" | "top-right"): CSSProperties => ({
	position: "absolute",
	top: 16,
	left: corner === "top-left" ? 16 : undefined,
	right: corner === "top-right" ? 16 : undefined,
	padding: "10px 14px",
	background: "rgba(6, 9, 18, 0.55)",
	borderRadius: 12,
	backdropFilter: "blur(6px)",
	minWidth: 140,
});

const hudLabelStyle: CSSProperties = {
	fontSize: 10,
	letterSpacing: "0.25em",
	opacity: 0.8,
	marginBottom: 4,
};

const hudReadoutStyle: CSSProperties = {
	fontSize: 11,
	marginTop: 4,
	fontFamily: '"Poppins", system-ui, sans-serif',
	letterSpacing: "0.1em",
};

const crosshairStyle: CSSProperties = {
	position: "absolute",
	top: "50%",
	left: "50%",
	width: 6,
	height: 6,
	transform: "translate(-50%, -50%)",
	borderRadius: "50%",
	background: OBJEXOOM_PALETTE.indigo,
	boxShadow: `0 0 0 2px ${OBJEXOOM_PALETTE.violet}`,
};

const hintStyle: CSSProperties = {
	position: "absolute",
	bottom: 18,
	left: "50%",
	transform: "translateX(-50%)",
	fontSize: 11,
	letterSpacing: "0.18em",
	opacity: 0.6,
	whiteSpace: "nowrap",
};

const overlayStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	display: "grid",
	placeItems: "center",
	background: "rgba(6, 9, 18, 0.78)",
	pointerEvents: "auto",
	padding: 24,
	textAlign: "center",
};

const cardStyle: CSSProperties = {
	background: "rgba(17, 24, 39, 0.92)",
	border: "1px solid rgba(167, 139, 250, 0.35)",
	borderRadius: 16,
	padding: 36,
	color: OBJEXOOM_PALETTE.parchment,
	textAlign: "center",
};

const overlayTitleStyle: CSSProperties = {
	fontFamily: '"Poppins", system-ui, sans-serif',
	fontWeight: 800,
	letterSpacing: "-0.04em",
	fontSize: "clamp(40px, 7vw, 64px)",
	margin: 0,
	background: `linear-gradient(135deg, ${OBJEXOOM_PALETTE.indigo}, ${OBJEXOOM_PALETTE.violet}, ${OBJEXOOM_PALETTE.amber})`,
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	lineHeight: 0.95,
};

function ctaButton(bg: string, primary: boolean): CSSProperties {
	return {
		padding: "12px 22px",
		borderRadius: 10,
		border: primary ? "none" : "1px solid rgba(255,255,255,0.2)",
		background: bg,
		color: primary ? OBJEXOOM_PALETTE.ink : OBJEXOOM_PALETTE.parchment,
		fontFamily: '"Poppins", system-ui, sans-serif',
		fontWeight: 700,
		fontSize: 13,
		letterSpacing: "0.18em",
		cursor: "pointer",
	};
}

function weaponChipStyle(active: boolean, owned: boolean, accent: string): CSSProperties {
	return {
		padding: "6px 10px",
		borderRadius: 10,
		fontSize: 11,
		fontWeight: 700,
		letterSpacing: "0.05em",
		border: active ? `1px solid ${accent}` : "1px solid transparent",
		background: active
			? `${accent}22`
			: owned
				? "rgba(255,255,255,0.05)"
				: "rgba(255,255,255,0.02)",
		color: owned ? OBJEXOOM_PALETTE.parchment : `${OBJEXOOM_PALETTE.parchment}55`,
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
		// biome-ignore lint/a11y/useSemanticElements: custom pip-based HP meter, native <meter> breaks visual layout
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
							background: lit ? OBJEXOOM_PALETTE.amber : "rgba(167,139,250,0.18)",
							boxShadow: lit
								? `0 0 6px ${OBJEXOOM_PALETTE.amber}aa`
								: "inset 0 0 0 1px rgba(255,255,255,0.06)",
						}}
					/>
				);
			})}
		</div>
	);
}

const lowHealthWarningStyle: CSSProperties = {
	marginTop: 4,
	fontSize: 11,
	fontWeight: 700,
	letterSpacing: "0.1em",
	color: "#dc2626",
	textShadow: "0 0 6px rgba(220, 38, 38, 0.45)",
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
	if (locked) return null;
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
					background: "rgba(6, 9, 18, 0.7)",
					borderRadius: 14,
					border: `1px solid ${OBJEXOOM_PALETTE.violet}55`,
					fontWeight: 700,
					letterSpacing: "0.18em",
					fontSize: 13,
					color: OBJEXOOM_PALETTE.parchment,
					textShadow: `0 0 8px ${OBJEXOOM_PALETTE.violet}88`,
				}}
			>
				CLICK TO ENGAGE — ESC RELEASES MOUSE
			</motion.div>
		</div>
	);
}
