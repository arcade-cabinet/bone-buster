import type { GameState } from "@store/gameState";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "@styles/tokens/index";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * PT1B — mission-complete ceremony (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1). Renders when status === "won".
 *
 * Modernized-DOOM polish bar — the generic OverlayCard used by
 * PAUSED / YOU DIED / LEVEL COMPLETE doesn't carry the celebration
 * weight a campaign-clear deserves. This slot:
 *
 *   - Layered radial vignette: indigo at edges (calm) + amber rim
 *     pulse (triumph), mixBlendMode screen — reads against the
 *     red GOING BACK chevrons still rendering underneath.
 *   - Stencil "MISSION COMPLETE" headline scales-in with spring
 *     stiffness=220 damping=18, glow textShadow ramped over 600ms.
 *   - Run-summary card lists KILLS / SECRETS / TIME / SCORE / DMG
 *     with tick-up numbers (each integer counts from 0 to final
 *     over 900ms, staggered 120ms per stat — same easing as the
 *     POL11 damage-number punch curve).
 *   - Primary CTA "RETURN TO MENU" enters last (1100ms in), amber
 *     fill, spring-eased.
 *
 * The generic OverlayCard for status==="won" is retired in
 * BoneBusterHUD.tsx — this slot owns the visual.
 */

interface Stat {
	readonly label: string;
	readonly value: number;
	readonly suffix?: string;
}

function TickUpNumber({
	value,
	delayMs,
	durationMs,
}: {
	value: number;
	delayMs: number;
	durationMs: number;
}) {
	const [shown, setShown] = useState(0);
	useEffect(() => {
		let raf = 0;
		const start = performance.now() + delayMs;
		const tick = () => {
			const now = performance.now();
			const t = Math.max(0, Math.min(1, (now - start) / durationMs));
			// ease-out-cubic for satisfying tick-up
			const eased = 1 - (1 - t) ** 3;
			setShown(Math.round(value * eased));
			if (t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [value, delayMs, durationMs]);
	return <span>{shown}</span>;
}

function formatTimeFromMs(ms: number): string {
	const total = Math.round(ms / 1000);
	const min = Math.floor(total / 60);
	const sec = total % 60;
	return `${min}:${String(sec).padStart(2, "0")}`;
}

export function MissionCompleteCeremony({
	state,
	onReturnToMenu,
}: {
	state: GameState;
	onReturnToMenu: () => void;
}) {
	if (state.status !== "won") return null;

	const elapsedMs = Math.max(0, performance.now() - state.run.runStartAt);
	const stats: readonly Stat[] = [
		{ label: "KILLS", value: state.run.runTotalKills },
		{ label: "SECRETS", value: state.run.runTotalSecrets },
		{ label: "TIME", value: Math.round(elapsedMs / 1000), suffix: "s" },
		{ label: "SCORE", value: state.run.runTotalScore },
		{ label: "DMG TAKEN", value: state.run.runTotalDamageTaken },
	];

	return (
		<motion.div
			style={{
				position: "absolute",
				inset: 0,
				display: "grid",
				placeItems: "center",
				pointerEvents: "auto",
				zIndex: 1000,
			}}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
		>
			{/* Indigo calm vignette — outer ring */}
			<motion.div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at center, rgba(99, 102, 241, 0) 35%, rgba(99, 102, 241, 0.32) 100%)",
					mixBlendMode: "screen",
					pointerEvents: "none",
				}}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.6, ease: "easeOut" }}
			/>
			{/* Amber triumph rim — pulses */}
			<motion.div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at center, rgba(245, 158, 11, 0) 55%, rgba(245, 158, 11, 0.28) 100%)",
					mixBlendMode: "screen",
					pointerEvents: "none",
				}}
				initial={{ opacity: 0 }}
				animate={{ opacity: [0, 0.9, 0.5, 0.9] }}
				transition={{ duration: 2.2, ease: "easeInOut", times: [0, 0.3, 0.65, 1] }}
			/>
			<motion.div
				style={{
					position: "relative",
					padding: "32px 40px",
					background: `${SCALE.ink[950]}d9`,
					border: `1px solid ${SCALE.amber[400]}88`,
					borderRadius: 14,
					boxShadow: `0 0 40px ${SCALE.amber[600]}44, inset 0 0 24px ${SCALE.indigo[700]}22`,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 18,
					minWidth: 360,
					pointerEvents: "auto",
				}}
				initial={{ scale: 0.6, y: 32, opacity: 0 }}
				animate={{ scale: 1, y: 0, opacity: 1 }}
				transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.2 }}
			>
				<motion.h1
					style={{
						margin: 0,
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 38,
						letterSpacing: LETTER_SPACING.display,
						color: SCALE.amber[100],
						textShadow: `0 0 18px ${SCALE.amber[500]}aa, 0 0 4px ${SCALE.amber[300]}`,
					}}
					initial={{ textShadow: `0 0 0px ${SCALE.amber[500]}00` }}
					animate={{ textShadow: `0 0 18px ${SCALE.amber[500]}aa, 0 0 4px ${SCALE.amber[300]}` }}
					transition={{ duration: 0.6, delay: 0.4 }}
				>
					MISSION COMPLETE
				</motion.h1>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "auto auto",
						columnGap: 32,
						rowGap: 8,
						fontFamily: FONT_FAMILY.body,
						fontSize: 14,
						color: ROLE.textPrimary,
					}}
				>
					{stats.map((stat, idx) => (
						<motion.div
							key={stat.label}
							style={{ display: "contents" }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.3, delay: 0.5 + idx * 0.12 }}
						>
							<span
								style={{
									letterSpacing: LETTER_SPACING.hudLabel,
									fontWeight: FONT_WEIGHT.semibold,
									opacity: 0.65,
									textAlign: "right",
								}}
							>
								{stat.label}
							</span>
							<span
								style={{
									fontFamily: FONT_FAMILY.display,
									fontWeight: FONT_WEIGHT.bold,
									color: SCALE.amber[200],
									textAlign: "left",
								}}
							>
								{stat.label === "TIME" ? (
									formatTimeFromMs(elapsedMs)
								) : (
									<TickUpNumber value={stat.value} delayMs={500 + idx * 120} durationMs={900} />
								)}
							</span>
						</motion.div>
					))}
				</div>
				<motion.button
					type="button"
					onClick={onReturnToMenu}
					style={{
						marginTop: 8,
						padding: "12px 28px",
						background: SCALE.amber[500],
						color: SCALE.ink[950],
						border: "none",
						borderRadius: 8,
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 14,
						letterSpacing: LETTER_SPACING.display,
						cursor: "pointer",
						pointerEvents: "auto",
					}}
					initial={{ opacity: 0, y: 12, scale: 0.9 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ type: "spring", stiffness: 280, damping: 22, delay: 1.1 }}
					whileHover={{ scale: 1.04 }}
					whileTap={{ scale: 0.98 }}
				>
					RETURN TO MENU
				</motion.button>
			</motion.div>
		</motion.div>
	);
}
