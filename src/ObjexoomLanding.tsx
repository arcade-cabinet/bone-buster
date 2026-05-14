"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { OBJEXOOM_PALETTE } from "./constants";
import {
	DIFFICULTY_BLURB,
	DIFFICULTY_LABEL,
	type Difficulty,
	LEVEL_LABEL,
	type LevelChoice,
	type ObjexoomSettings,
} from "./settings";
import { getMusicLoadProgress } from "./sfx";

type Props = Readonly<{
	settings: ObjexoomSettings;
	onSettingsChange: (patch: Partial<ObjexoomSettings>) => void;
	onStart: () => void;
	onQuit: () => void;
	canResume?: boolean;
	onResume?: () => void;
}>;

// E1 — DOOM-flavored tip carousel for the landing footer.
const TIPS = [
	"Strafe — they aim where you were.",
	"The portal opens at the key.",
	"Imps explode. Take cover.",
	"Skeletons are slow. Wraiths phase walls.",
] as const;

type Pane = "main" | "difficulty" | "level" | "options" | "help";

const DIFFICULTY_ORDER: Difficulty[] = [
	"tooYoung",
	"notTooRough",
	"hurtMePlenty",
	"ultraViolence",
	"nightmare",
];

const LEVEL_ORDER: LevelChoice[] = ["procedural", 1, 2, 3, 4, 5];

export function ObjexoomLanding({
	settings,
	onSettingsChange,
	onStart,
	onQuit,
	canResume = false,
	onResume,
}: Props) {
	const [pane, setPane] = useState<Pane>("main");
	const [tipIdx, setTipIdx] = useState(0);
	const reduceMotion = useReducedMotion();

	// E1 — rotate tip every 4.5s while we're on the landing.
	useEffect(() => {
		if (reduceMotion) return;
		const t = window.setInterval(() => {
			setTipIdx((idx) => (idx + 1) % TIPS.length);
		}, 4500);
		return () => window.clearInterval(t);
	}, [reduceMotion]);

	// E2 — global ESC strips ?objexoom and exits to host page.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.code === "Escape") {
				e.preventDefault();
				onQuit();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onQuit]);

	return (
		<div style={rootStyle}>
			<BackdropEffect />

			<header style={headerStyle}>
				<motion.div
					initial={{ y: -12, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
				>
					<div style={eyebrowStyle}>VERSION 0.1 · EARLY ACCESS</div>
					<h1 style={titleStyle}>OBJEXOOM</h1>
					<div style={tagStyle}>RIP AND TEAR · THE OBJEXIV CUT</div>
				</motion.div>
			</header>

			<main style={mainStyle}>
				{pane === "main" && (
					<MainMenu
						onNewGame={() => setPane("difficulty")}
						onOptions={() => setPane("options")}
						onHelp={() => setPane("help")}
						onQuit={onQuit}
						canResume={canResume}
						onResume={onResume}
					/>
				)}
				{pane === "difficulty" && (
					<DifficultyPane
						current={settings.difficulty}
						onSelect={(d) => {
							onSettingsChange({ difficulty: d });
							setPane("level");
						}}
						onBack={() => setPane("main")}
					/>
				)}
				{pane === "level" && (
					<LevelPane
						current={settings.level}
						onSelect={(l) => {
							onSettingsChange({ level: l });
							onStart();
						}}
						onBack={() => setPane("difficulty")}
					/>
				)}
				{pane === "options" && (
					<OptionsPane
						settings={settings}
						onChange={onSettingsChange}
						onBack={() => setPane("main")}
					/>
				)}
				{pane === "help" && <HelpPane onBack={() => setPane("main")} />}
			</main>

			<footer style={footerStyle}>
				<span>OBJEXOOM v0.1</span>
				<span style={{ opacity: 0.5 }}>·</span>
				<span>ESC → exit</span>
				<span style={{ opacity: 0.5 }}>·</span>
				<MusicLoadIndicator />
				<span style={{ opacity: 0.5 }}>·</span>
				<motion.span
					key={tipIdx}
					initial={reduceMotion ? false : { opacity: 0, y: 4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.45, ease: "easeOut" }}
					style={{ opacity: 0.85, fontStyle: "italic" }}
				>
					TIP — {TIPS[tipIdx]}
				</motion.span>
			</footer>
		</div>
	);
}

function MainMenu({
	onNewGame,
	onOptions,
	onHelp,
	onQuit,
	canResume,
	onResume,
}: {
	onNewGame: () => void;
	onOptions: () => void;
	onHelp: () => void;
	onQuit: () => void;
	canResume: boolean;
	onResume?: () => void;
}) {
	return (
		<motion.nav
			aria-label="OBJEXOOM main menu"
			style={menuStyle}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35 }}
		>
			{canResume && onResume && <MenuItem label="RESUME RUN" onClick={onResume} primary />}
			<MenuItem
				label={canResume ? "NEW GAME" : "NEW GAME"}
				onClick={onNewGame}
				primary={!canResume}
			/>
			<MenuItem label="OPTIONS" onClick={onOptions} />
			<MenuItem label="HOW TO PLAY" onClick={onHelp} />
			<MenuItem label="QUIT" onClick={onQuit} />
		</motion.nav>
	);
}

function DifficultyPane({
	current,
	onSelect,
	onBack,
}: {
	current: Difficulty;
	onSelect: (d: Difficulty) => void;
	onBack: () => void;
}) {
	return (
		<motion.section
			aria-label="Choose skill level"
			style={paneStyle}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35 }}
		>
			<div style={paneHeadingStyle}>SKILL LEVEL</div>
			<div style={paneListStyle}>
				{DIFFICULTY_ORDER.map((d) => (
					<button
						type="button"
						key={d}
						onClick={() => onSelect(d)}
						style={difficultyChip(d === current)}
						aria-pressed={d === current}
					>
						<div style={{ fontWeight: 700 }}>{DIFFICULTY_LABEL[d]}</div>
						<div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{DIFFICULTY_BLURB[d]}</div>
					</button>
				))}
			</div>
			<MenuItem label="BACK" onClick={onBack} />
		</motion.section>
	);
}

function LevelPane({
	current,
	onSelect,
	onBack,
}: {
	current: LevelChoice;
	onSelect: (l: LevelChoice) => void;
	onBack: () => void;
}) {
	return (
		<motion.section
			aria-label="Choose level"
			style={paneStyle}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35 }}
		>
			<div style={paneHeadingStyle}>LEVEL</div>
			<div style={paneGridStyle}>
				{LEVEL_ORDER.map((l) => (
					<button
						type="button"
						key={String(l)}
						onClick={() => onSelect(l)}
						style={levelChip(l === current)}
						aria-pressed={l === current}
					>
						{LEVEL_LABEL[l]}
					</button>
				))}
			</div>
			<MenuItem label="BACK" onClick={onBack} />
		</motion.section>
	);
}

function OptionsPane({
	settings,
	onChange,
	onBack,
}: {
	settings: ObjexoomSettings;
	onChange: (patch: Partial<ObjexoomSettings>) => void;
	onBack: () => void;
}) {
	return (
		<motion.section
			aria-label="Options"
			style={paneStyle}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35 }}
		>
			<div style={paneHeadingStyle}>OPTIONS</div>

			<div style={optionRowStyle}>
				<label htmlFor="objexoom-sound" style={optionLabelStyle}>
					SOUND
				</label>
				<button
					id="objexoom-sound"
					type="button"
					onClick={() => onChange({ soundEnabled: !settings.soundEnabled })}
					style={toggleStyle(settings.soundEnabled)}
					aria-pressed={settings.soundEnabled}
				>
					{settings.soundEnabled ? "ON" : "OFF"}
				</button>
			</div>

			<div style={optionRowStyle}>
				<label htmlFor="objexoom-mouse" style={optionLabelStyle}>
					MOUSE SENSITIVITY
				</label>
				<input
					id="objexoom-mouse"
					type="range"
					min={0.5}
					max={2.5}
					step={0.1}
					value={settings.mouseSensitivity}
					onChange={(e) => onChange({ mouseSensitivity: Number(e.target.value) })}
					style={sliderStyle}
				/>
				<span style={optionValueStyle}>{settings.mouseSensitivity.toFixed(1)}×</span>
			</div>

			<div style={optionRowStyle}>
				<label htmlFor="objexoom-touch" style={optionLabelStyle}>
					TOUCH-LOOK SENSITIVITY
				</label>
				<input
					id="objexoom-touch"
					type="range"
					min={0.5}
					max={4}
					step={0.1}
					value={settings.touchLookSensitivity}
					onChange={(e) => onChange({ touchLookSensitivity: Number(e.target.value) })}
					style={sliderStyle}
				/>
				<span style={optionValueStyle}>{settings.touchLookSensitivity.toFixed(1)}×</span>
			</div>

			<MenuItem label="BACK" onClick={onBack} />
		</motion.section>
	);
}

function HelpPane({ onBack }: { onBack: () => void }) {
	return (
		<motion.section
			aria-label="How to play"
			style={paneStyle}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35 }}
		>
			<div style={paneHeadingStyle}>CONTROLS</div>
			<div style={helpGridStyle}>
				<HelpRow action="MOVE" desktop="W A S D / arrow keys" touch="Left thumb-stick" />
				<HelpRow action="AIM" desktop="Mouse (pointer-locked)" touch="Right thumb-stick" />
				<HelpRow action="FIRE" desktop="Left-click" touch="FIRE button" />
				<HelpRow action="SWAP WEAPON" desktop="1 / 2 / 3 · scroll-wheel" touch="Weapon chips" />
				<HelpRow action="PAUSE" desktop="ESC" touch="ESC button" />
			</div>

			<div style={{ ...paneHeadingStyle, marginTop: 20 }}>OBJECTIVE</div>
			<p style={objectiveStyle}>
				Clear the level. Find the floating amber key. Step into the violet portal. The corridors are
				not pleased to see you.
			</p>

			<MenuItem label="BACK" onClick={onBack} />
		</motion.section>
	);
}

function HelpRow({ action, desktop, touch }: { action: string; desktop: string; touch: string }) {
	return (
		<>
			<div style={helpActionStyle}>{action}</div>
			<div style={helpDetailStyle}>
				<div>{desktop}</div>
				<div style={{ opacity: 0.6, fontSize: 11 }}>· {touch}</div>
			</div>
		</>
	);
}

function MenuItem({
	label,
	onClick,
	primary,
}: {
	label: string;
	onClick: () => void;
	primary?: boolean;
}) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			whileHover={{ x: 4 }}
			whileTap={{ x: 8 }}
			style={menuItemStyle(primary)}
		>
			<span style={menuItemArrowStyle(primary)}>›</span>
			<span>{label}</span>
		</motion.button>
	);
}

function BackdropEffect() {
	return (
		<div aria-hidden style={backdropStyle}>
			<div style={backdropGridStyle} />
			<div style={backdropGlowStyle} />
		</div>
	);
}

const rootStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	display: "grid",
	gridTemplateRows: "auto 1fr auto",
	color: OBJEXOOM_PALETTE.parchment,
	fontFamily: '"Inter", system-ui, sans-serif',
	background: OBJEXOOM_PALETTE.ink,
	overflow: "hidden",
};

const headerStyle: CSSProperties = {
	textAlign: "center",
	padding: "clamp(20px, 4vh, 48px) 24px 8px",
	zIndex: 1,
};

const eyebrowStyle: CSSProperties = {
	fontSize: 11,
	letterSpacing: "0.25em",
	color: OBJEXOOM_PALETTE.amber,
	marginBottom: 8,
};

const titleStyle: CSSProperties = {
	margin: 0,
	fontFamily: '"Poppins", system-ui, sans-serif',
	fontWeight: 800,
	letterSpacing: "-0.06em",
	fontSize: "clamp(56px, 14vw, 144px)",
	lineHeight: 0.9,
	background: `linear-gradient(135deg, ${OBJEXOOM_PALETTE.indigo}, ${OBJEXOOM_PALETTE.violet} 55%, ${OBJEXOOM_PALETTE.amber})`,
	WebkitBackgroundClip: "text",
	WebkitTextFillColor: "transparent",
	textShadow: `0 4px 48px ${OBJEXOOM_PALETTE.violet}33`,
};

const tagStyle: CSSProperties = {
	marginTop: 4,
	fontSize: 12,
	letterSpacing: "0.3em",
	opacity: 0.7,
};

const mainStyle: CSSProperties = {
	display: "grid",
	placeItems: "center",
	padding: "clamp(12px, 3vh, 32px) 24px",
	zIndex: 1,
};

const menuStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	minWidth: "min(360px, 92vw)",
};

const paneStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 12,
	width: "min(560px, 96vw)",
};

const paneHeadingStyle: CSSProperties = {
	fontSize: 12,
	letterSpacing: "0.3em",
	color: OBJEXOOM_PALETTE.amber,
	textTransform: "uppercase",
	margin: "0 0 8px 4px",
};

const paneListStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 8,
};

const paneGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
	gap: 8,
};

function menuItemStyle(primary?: boolean): CSSProperties {
	return {
		display: "flex",
		alignItems: "center",
		gap: 12,
		padding: "12px 16px",
		background: "transparent",
		border: "none",
		color: primary ? OBJEXOOM_PALETTE.amber : OBJEXOOM_PALETTE.parchment,
		fontFamily: '"Poppins", system-ui, sans-serif',
		fontWeight: 700,
		fontSize: 18,
		letterSpacing: "0.15em",
		cursor: "pointer",
		textAlign: "left",
		borderRadius: 4,
	};
}

function menuItemArrowStyle(primary?: boolean): CSSProperties {
	return {
		fontSize: 22,
		color: primary ? OBJEXOOM_PALETTE.amber : OBJEXOOM_PALETTE.violet,
		width: 16,
	};
}

function difficultyChip(active: boolean): CSSProperties {
	return {
		display: "block",
		textAlign: "left",
		padding: "10px 14px",
		borderRadius: 8,
		border: active ? `1px solid ${OBJEXOOM_PALETTE.amber}` : "1px solid rgba(255,255,255,0.08)",
		background: active ? `${OBJEXOOM_PALETTE.amber}1a` : "rgba(255,255,255,0.03)",
		color: OBJEXOOM_PALETTE.parchment,
		fontFamily: '"Inter", system-ui, sans-serif',
		cursor: "pointer",
	};
}

function levelChip(active: boolean): CSSProperties {
	return {
		padding: "16px 12px",
		borderRadius: 8,
		border: active ? `1px solid ${OBJEXOOM_PALETTE.violet}` : "1px solid rgba(255,255,255,0.08)",
		background: active ? `${OBJEXOOM_PALETTE.violet}22` : "rgba(255,255,255,0.03)",
		color: OBJEXOOM_PALETTE.parchment,
		fontFamily: '"Poppins", system-ui, sans-serif',
		fontWeight: 700,
		fontSize: 14,
		letterSpacing: "0.15em",
		cursor: "pointer",
	};
}

const optionRowStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "1fr auto auto",
	alignItems: "center",
	gap: 12,
	padding: "10px 12px",
	borderRadius: 8,
	background: "rgba(255,255,255,0.03)",
	border: "1px solid rgba(255,255,255,0.06)",
};

const optionLabelStyle: CSSProperties = {
	fontSize: 12,
	letterSpacing: "0.18em",
	textTransform: "uppercase",
	opacity: 0.85,
};

const optionValueStyle: CSSProperties = {
	fontSize: 12,
	opacity: 0.75,
	minWidth: 32,
	textAlign: "right",
};

const sliderStyle: CSSProperties = {
	width: "min(220px, 50vw)",
	accentColor: OBJEXOOM_PALETTE.violet,
};

function toggleStyle(on: boolean): CSSProperties {
	return {
		padding: "4px 14px",
		borderRadius: 6,
		border: "none",
		background: on ? OBJEXOOM_PALETTE.violet : "rgba(255,255,255,0.08)",
		color: OBJEXOOM_PALETTE.parchment,
		fontFamily: '"Poppins", system-ui, sans-serif',
		fontWeight: 700,
		fontSize: 12,
		letterSpacing: "0.18em",
		cursor: "pointer",
	};
}

const helpGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "auto 1fr",
	gap: "6px 18px",
	alignItems: "baseline",
	padding: "0 4px",
};

const helpActionStyle: CSSProperties = {
	fontFamily: '"Poppins", system-ui, sans-serif',
	fontWeight: 700,
	letterSpacing: "0.15em",
	color: OBJEXOOM_PALETTE.amber,
	fontSize: 12,
};

const helpDetailStyle: CSSProperties = {
	fontSize: 13,
	display: "flex",
	flexWrap: "wrap",
	gap: 6,
};

const objectiveStyle: CSSProperties = {
	fontSize: 13,
	lineHeight: 1.5,
	color: `${OBJEXOOM_PALETTE.parchment}cc`,
	padding: "0 4px",
};

const footerStyle: CSSProperties = {
	display: "flex",
	gap: 8,
	justifyContent: "center",
	alignItems: "center",
	padding: "12px 16px max(12px, env(safe-area-inset-bottom))",
	fontSize: 11,
	letterSpacing: "0.18em",
	color: `${OBJEXOOM_PALETTE.parchment}66`,
	zIndex: 1,
};

const backdropStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	zIndex: 0,
};

const backdropGridStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	backgroundImage: `linear-gradient(rgba(167,139,250,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.05) 1px, transparent 1px)`,
	backgroundSize: "40px 40px",
	maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 75%)",
};

const backdropGlowStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	background: `radial-gradient(ellipse at 50% 30%, ${OBJEXOOM_PALETTE.violet}22, transparent 65%), radial-gradient(ellipse at 80% 80%, ${OBJEXOOM_PALETTE.amber}11, transparent 60%)`,
};

// K6 — audio loading indicator. After the player triggers a START
// gesture elsewhere in the app the SFX subsystem initializes synth
// voices for the procedural music. We poll the loaded count once per
// second so the landing can mirror the reference's `(N/6) loaded`
// pattern without coupling to Tone.js callbacks.
function MusicLoadIndicator() {
	const [progress, setProgress] = useState(getMusicLoadProgress());
	useEffect(() => {
		const id = window.setInterval(() => {
			setProgress(getMusicLoadProgress());
		}, 1000);
		return () => window.clearInterval(id);
	}, []);
	const ready = progress.loaded === progress.total;
	return (
		<span data-testid="objexoom-music-progress" style={{ opacity: ready ? 0.5 : 0.85 }}>
			{ready
				? `AUDIO READY (${progress.total}/${progress.total})`
				: `AUDIO ${progress.loaded}/${progress.total}`}
		</span>
	);
}
