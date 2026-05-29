import type { GameState } from "@store/gameState";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";

/**
 * POL34 — pause overlay (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1). Renders when status === "paused".
 *
 * Replaces the generic <OverlayCard> the paused state previously used.
 * Pattern mirrors MissionCompleteCeremony (PT1B) and PT4B's RETURN TO
 * SPAWN card: layered radial vignette + stencil headline + button
 * stack with spring-eased entry. Aligns the paused state with the
 * modernized-DOOM polish bar set by the rest of the slot stack.
 *
 * Three buttons match the pre-existing generic-card affordances:
 *   - RESUME (primary)         — onResume
 *   - MAIN MENU (secondary)    — onReturnToLanding
 *   - QUIT (tertiary)          — onQuit
 *
 * Per-button row stack: spring-eased entry, stagger 100ms per row so
 * the user reads them in priority order. The whole overlay
 * AnimatePresence-wraps so an ESC dismiss fades out cleanly.
 */
export function PauseOverlay({
	state,
	onResume,
	onReturnToLanding,
	onQuit,
}: {
	state: GameState;
	onResume: () => void;
	onReturnToLanding: () => void;
	onQuit: () => void;
}) {
	return (
		<AnimatePresence>
			{state.status === "paused" && (
				<motion.div
					key="pause-overlay"
					style={{
						position: "absolute",
						inset: 0,
						display: "grid",
						placeItems: "center",
						pointerEvents: "auto",
						background: `
							radial-gradient(circle at 50% 35%, ${SCALE.indigo[700]}55 0%, transparent 65%),
							radial-gradient(circle at 50% 65%, ${SCALE.ink[950]}d0 30%, ${SCALE.ink[950]}f0 100%)
						`,
						mixBlendMode: "normal",
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.25, ease: "easeOut" }}
				>
					<motion.div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 28,
							padding: "40px 60px",
						}}
						initial={{ y: 12, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 8, opacity: 0 }}
						transition={{ type: "spring", stiffness: 220, damping: 22 }}
					>
						<motion.h2
							style={{
								margin: 0,
								fontFamily: FONT_FAMILY.display,
								fontWeight: FONT_WEIGHT.bold,
								fontSize: 64,
								letterSpacing: LETTER_SPACING.display,
								color: ROLE.textHighContrast,
								textShadow: `
									0 0 18px ${SCALE.indigo[400]}88,
									0 0 36px ${SCALE.indigo[500]}55
								`,
								textAlign: "center",
							}}
							initial={{ scale: 0.85 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", stiffness: 240, damping: 20, delay: 0.05 }}
						>
							PAUSED
						</motion.h2>
						<div
							style={{
								fontFamily: FONT_FAMILY.body,
								fontSize: 13,
								letterSpacing: LETTER_SPACING.hudLabel,
								color: ROLE.textSecondary,
								marginTop: -16,
							}}
						>
							The corridors will wait.
						</div>
						<RunStatsLine state={state} />
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 12,
								minWidth: 260,
							}}
						>
							<PauseButton label="RESUME" onClick={onResume} primary delay={0.18} />
							<PauseButton label="MAIN MENU" onClick={onReturnToLanding} delay={0.28} />
							<PauseButton label="QUIT" onClick={onQuit} muted delay={0.38} />
						</div>
						<div
							style={{
								fontFamily: FONT_FAMILY.body,
								fontSize: 11,
								letterSpacing: LETTER_SPACING.hudLabel,
								color: ROLE.textMuted,
								marginTop: 4,
							}}
						>
							ESC TO RESUME
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function PauseButton({
	label,
	onClick,
	primary = false,
	muted = false,
	delay = 0,
}: {
	label: string;
	onClick: () => void;
	primary?: boolean;
	muted?: boolean;
	delay?: number;
}) {
	const color = primary ? SCALE.amber[100] : muted ? ROLE.textMuted : ROLE.textPrimary;
	const bg = primary ? `${SCALE.amber[600]}c0` : muted ? "transparent" : `${SCALE.indigo[800]}80`;
	const border = primary ? SCALE.amber[300] : muted ? ROLE.borderSoft : SCALE.indigo[400];
	return (
		<motion.button
			type="button"
			onClick={onClick}
			style={{
				padding: "12px 24px",
				background: bg,
				border: `1px solid ${border}`,
				borderRadius: 8,
				fontFamily: FONT_FAMILY.display,
				fontWeight: FONT_WEIGHT.bold,
				fontSize: 14,
				letterSpacing: LETTER_SPACING.display,
				color,
				cursor: "pointer",
				textShadow: primary ? `0 0 10px ${SCALE.amber[400]}aa` : undefined,
			}}
			initial={{ x: -16, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			transition={{ type: "spring", stiffness: 280, damping: 24, delay }}
		>
			{label}
		</motion.button>
	);
}

function RunStatsLine({ state }: { state: GameState }) {
	const kills = state.kills;
	const total = state.totalEnemies;
	const score = state.score;
	const hp = Math.max(0, state.hp);
	return (
		<div
			style={{
				display: "flex",
				gap: 18,
				fontFamily: FONT_FAMILY.display,
				fontSize: 13,
				letterSpacing: LETTER_SPACING.display,
				color: ROLE.textSecondary,
				marginTop: -8,
			}}
		>
			<span>
				<span style={{ opacity: 0.6 }}>HP</span> {hp}/{state.maxHp}
			</span>
			<span style={{ opacity: 0.4 }}>·</span>
			<span>
				<span style={{ opacity: 0.6 }}>KILLS</span> {kills}/{total}
			</span>
			{score > 0 && (
				<>
					<span style={{ opacity: 0.4 }}>·</span>
					<span>
						<span style={{ opacity: 0.6 }}>SCORE</span> {score}
					</span>
				</>
			)}
		</div>
	);
}
