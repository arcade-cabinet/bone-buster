import { getMusicLoadProgress } from "@audio/sfx";
import { formatRunDuration, openRunHistory, type RunRecord } from "@store/runHistory";
import {
	DIFFICULTY_BLURB,
	DIFFICULTY_LABEL,
	type Difficulty,
	LEVEL_LABEL,
	type LevelChoice,
	type ObjexoomSettings,
} from "@store/settings";
import { motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { BoneBusterWordmark } from "./BoneBusterWordmark";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "./design-tokens";
import { TYPE } from "./design-tokens/typography";
import { ScuffShader } from "./ScuffShader";

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
	"Each run picks one of five archetypes from its seed.",
	"Arena enemies hit harder; library books reward exploration.",
	"Shoot the wall switch — secrets stack across the whole run.",
	"Bottles +HP, books +ammo, treasure +score.",
	"Lava floors damage you over time. So does water if you wade too long.",
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
					<BoneBusterWordmark width={720} height={180} />
					<motion.div
						style={tagStyle}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, delay: 1.2, ease: "easeOut" }}
					>
						They had it coming.
					</motion.div>
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
				<span>Bone Buster v0.5</span>
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
			aria-label="Bone Buster main menu"
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
			<BestRunChip />
		</motion.nav>
	);
}

/**
 * POL6 / POL32 — Reads runHistory asynchronously on landing-mount.
 * When at least one run has been persisted, shows a stencil chip with
 * the best run's level / time / kills breakdown plus a secondary
 * run-count footer. Hidden during initial async load and when no runs
 * exist (fresh install) — no landing space is reserved for it.
 *
 * Format (POL32 spec): `BEST RUN · M{level} · {mm:ss} · {kills} KILLS`
 * Footer: `{N} RUN{S} · {SECRETS}` (secrets line only when > 0).
 */
function BestRunChip() {
	const [best, setBest] = useState<RunRecord | null>(null);
	const [count, setCount] = useState(0);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const db = await openRunHistory();
				const [b, c] = await Promise.all([db.bestRun(), db.runCount()]);
				if (cancelled) return;
				setBest(b);
				setCount(c);
			} finally {
				if (!cancelled) setReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);
	if (!ready || count === 0 || !best) return null;
	const durationMs = Math.max(0, best.endedAt - best.startedAt);
	const durationLabel = formatRunDuration(durationMs);
	const levelLabel = best.levelSet === "procedural" ? "RANDOM" : `M${best.levelSet}`;
	const outcomeLabel = best.outcome === "won" ? "WON" : "DIED";
	const secretSuffix =
		best.totalSecrets > 0
			? ` · ${best.totalSecrets} SECRET${best.totalSecrets === 1 ? "" : "S"}`
			: "";
	return (
		<div data-testid="objexoom-best-run-chip" style={bestRunChipStyle}>
			<div style={bestRunPrimaryRowStyle}>
				<span style={{ opacity: 0.7 }}>BEST RUN</span>
				<span style={{ opacity: 0.4, margin: "0 8px" }}>·</span>
				<span>{levelLabel}</span>
				<span style={{ opacity: 0.4, margin: "0 8px" }}>·</span>
				<span>{durationLabel}</span>
				<span style={{ opacity: 0.4, margin: "0 8px" }}>·</span>
				<span>{best.totalKills} KILLS</span>
			</div>
			<div style={bestRunSecondaryRowStyle}>
				<span style={{ opacity: 0.6 }}>{outcomeLabel}</span>
				<span style={{ opacity: 0.3, margin: "0 6px" }}>·</span>
				<span style={{ opacity: 0.6 }}>
					{count} RUN{count === 1 ? "" : "S"}
				</span>
				{secretSuffix && <span style={{ opacity: 0.6 }}>{secretSuffix}</span>}
			</div>
		</div>
	);
}

const bestRunChipStyle: CSSProperties = {
	marginTop: 16,
	fontFamily: FONT_FAMILY.display,
	fontSize: 11,
	fontWeight: FONT_WEIGHT.regular,
	letterSpacing: LETTER_SPACING.hudLabel,
	color: ROLE.accentPrimary,
	textAlign: "center",
	display: "flex",
	flexDirection: "column",
	gap: 4,
};

const bestRunPrimaryRowStyle: CSSProperties = {
	fontSize: 13,
	color: ROLE.accentPrimary,
	textShadow: `0 0 10px ${ROLE.accentPrimary}33`,
};

const bestRunSecondaryRowStyle: CSSProperties = {
	fontSize: 10,
	color: ROLE.textSecondary,
};

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

			<div style={{ ...paneHeadingStyle, marginTop: 20 }}>ARCHETYPES</div>
			<p style={objectiveStyle}>
				Every run picks one of five flavors deterministically from the seed:
				<br />
				<strong>CORRIDOR</strong> tight cool ink-violet halls · the baseline.
				<br />
				<strong>ARENA</strong> ember-red combat space · denser enemies, sparser cover.
				<br />
				<strong>COURTYARD</strong> cool dusk-indigo outdoor · mid density, foliage scatter.
				<br />
				<strong>SEWER</strong> damp parchment underground · oppressive, traps.
				<br />
				<strong>LIBRARY</strong> warm amber study halls · sparse enemies, dense props, NPCs.
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
	// R5 — ticket-stub card. -2° tilt, framer-motion spring lift on
	// hover, shadow expansion. Keyboard nav preserved (native <button>
	// semantics; whileFocus mirrors whileHover so Tab+Enter feels the
	// same as mouseover+click).
	return (
		<motion.button
			type="button"
			onClick={onClick}
			whileHover={{ rotate: 0, y: -2, scale: 1.02 }}
			whileFocus={{ rotate: 0, y: -2, scale: 1.02 }}
			whileTap={{ rotate: -2, y: 0, scale: 0.99 }}
			initial={{ rotate: -2 }}
			transition={{ type: "spring", stiffness: 360, damping: 22 }}
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
			{/* R4 — animated scuff-noise plate behind everything else.
			    Renders Perlin-style value-noise + buster-orange flash
			    scratches per docs/REBRAND.md §Visual identity. */}
			<ScuffShader />
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
	color: ROLE.textPrimary,
	fontFamily: FONT_FAMILY.body,
	background: ROLE.bgWorld,
	overflow: "hidden",
};

const headerStyle: CSSProperties = {
	textAlign: "center",
	padding: "clamp(20px, 4vh, 48px) 24px 8px",
	zIndex: 1,
};

const eyebrowStyle: CSSProperties = {
	fontSize: 11,
	letterSpacing: LETTER_SPACING.hudLabel,
	color: ROLE.actionKey,
	marginBottom: 8,
};

const tagStyle: CSSProperties = {
	marginTop: 18,
	fontFamily: TYPE.body,
	fontSize: 16,
	fontWeight: 500,
	letterSpacing: "0.14em",
	color: ROLE.text.secondary,
	textTransform: "uppercase",
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
	fontFamily: FONT_FAMILY.display,
	fontSize: 13,
	letterSpacing: LETTER_SPACING.display,
	color: ROLE.actionKey,
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
	// R5 — ticket-stub card. The framer-motion `initial={{rotate:-2}}`
	// + spring hover-lift live on the <motion.button> wrapper; the
	// static appearance below is the resting card surface.
	return {
		display: "flex",
		alignItems: "center",
		gap: 14,
		padding: "14px 22px 14px 18px",
		background: primary ? ROLE.bgPanelAlpha : ROLE.bgPanel,
		border: `1px solid ${primary ? ROLE.accent.primary : ROLE.surface.elevated}`,
		boxShadow: primary
			? `0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 ${ROLE.brand.bone3}33`
			: `0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 ${ROLE.brand.bone3}22`,
		color: primary ? ROLE.accent.primary : ROLE.text.primary,
		fontFamily: TYPE.display,
		fontWeight: FONT_WEIGHT.regular,
		fontSize: 22,
		letterSpacing: LETTER_SPACING.display,
		cursor: "pointer",
		textAlign: "left",
		borderRadius: 6,
		// Ticket-stub notch on the leading edge.
		clipPath:
			"polygon(0 8px, 8px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 14px 100%, 0 calc(100% - 14px))",
	};
}

function menuItemArrowStyle(primary?: boolean): CSSProperties {
	return {
		fontFamily: FONT_FAMILY.display,
		fontSize: 22,
		color: primary ? ROLE.actionKey : ROLE.accentPrimary,
		width: 16,
	};
}

function difficultyChip(active: boolean): CSSProperties {
	return {
		display: "block",
		textAlign: "left",
		padding: "10px 14px",
		borderRadius: 8,
		border: active ? `1px solid ${ROLE.actionKey}` : `1px solid ${SCALE.parchment[50]}14`,
		background: active ? `${ROLE.actionKey}1a` : `${SCALE.parchment[50]}08`,
		color: ROLE.textPrimary,
		fontFamily: FONT_FAMILY.body,
		cursor: "pointer",
	};
}

function levelChip(active: boolean): CSSProperties {
	return {
		padding: "16px 12px",
		borderRadius: 8,
		border: active ? `1px solid ${ROLE.accentPrimary}` : `1px solid ${SCALE.parchment[50]}14`,
		background: active ? `${ROLE.accentPrimary}22` : `${SCALE.parchment[50]}08`,
		color: ROLE.textPrimary,
		fontFamily: FONT_FAMILY.display,
		fontWeight: FONT_WEIGHT.regular,
		fontSize: 15,
		letterSpacing: LETTER_SPACING.display,
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
	background: `${SCALE.parchment[50]}08`,
	border: `1px solid ${SCALE.parchment[50]}0f`,
};

const optionLabelStyle: CSSProperties = {
	fontSize: 12,
	letterSpacing: LETTER_SPACING.hudLabel,
	textTransform: "uppercase",
	opacity: 0.85,
};

const optionValueStyle: CSSProperties = {
	fontFamily: FONT_FAMILY.display,
	fontSize: 13,
	letterSpacing: LETTER_SPACING.display,
	opacity: 0.85,
	minWidth: 32,
	textAlign: "right",
};

const sliderStyle: CSSProperties = {
	width: "min(220px, 50vw)",
	accentColor: ROLE.accentPrimary,
};

function toggleStyle(on: boolean): CSSProperties {
	return {
		padding: "4px 14px",
		borderRadius: 6,
		border: "none",
		background: on ? ROLE.accentPrimary : `${SCALE.parchment[50]}14`,
		color: ROLE.textPrimary,
		fontFamily: FONT_FAMILY.display,
		fontWeight: FONT_WEIGHT.regular,
		fontSize: 12,
		letterSpacing: LETTER_SPACING.hudLabel,
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
	fontFamily: FONT_FAMILY.display,
	fontWeight: FONT_WEIGHT.regular,
	letterSpacing: LETTER_SPACING.display,
	color: ROLE.actionKey,
	fontSize: 13,
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
	color: ROLE.textSecondary,
	padding: "0 4px",
};

const footerStyle: CSSProperties = {
	display: "flex",
	gap: 8,
	justifyContent: "center",
	alignItems: "center",
	padding: "12px 16px max(12px, env(safe-area-inset-bottom))",
	fontSize: 11,
	letterSpacing: LETTER_SPACING.hudLabel,
	color: ROLE.textMuted,
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
	backgroundImage: `linear-gradient(${SCALE.violet[300]}0d 1px, transparent 1px), linear-gradient(90deg, ${SCALE.violet[300]}0d 1px, transparent 1px)`,
	backgroundSize: "40px 40px",
	maskImage: `radial-gradient(ellipse at 50% 30%, ${SCALE.ink[950]} 40%, transparent 75%)`,
};

const backdropGlowStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	background: `radial-gradient(ellipse at 50% 30%, ${ROLE.accentPrimary}22, transparent 65%), radial-gradient(ellipse at 80% 80%, ${ROLE.actionKey}11, transparent 60%)`,
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
