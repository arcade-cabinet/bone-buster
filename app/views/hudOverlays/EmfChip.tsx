import { addBoneBusterListener } from "@engine/events";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING } from "@styles/tokens/index";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * PB5 step-2 — EMF reader HUD chip.
 *
 * Listens for the throttled `emfReading` event from the Scene's
 * per-frame tick and renders a stepwise 1-5 readout. Per
 * `docs/GHOST-HUNTING.md`, the design language is Phasmo-style —
 * level 5 is "you should already be running", level 1 is the
 * baseline "tool is alive" blip.
 *
 * Hidden when level === 0 (caller convention: 0 = no signal at all,
 * which only happens when the player doesn't own the reader OR no
 * live enemies exist on the map). Always-rendered framer-motion
 * `animate` updates keep the bars in sync without remounting.
 */

const BAR_COUNT = 5;

// PSX-style color ramp: cool green for low (passive observer), warm
// amber for mid (something's nearby), red for high (touching). Inline
// hex values because the design-token scale doesn't expose green; the
// token PR for a `signal` scale is its own follow-up.
const RAMP: readonly string[] = ["#2e7d32", "#558b2f", "#f9a825", "#ef6c00", "#c62828"];

export function EmfChip() {
	const [level, setLevel] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

	useEffect(() => {
		return addBoneBusterListener("emfReading", (evt) => {
			setLevel(evt.level);
		});
	}, []);

	if (level === 0) return null;

	return (
		<div
			data-testid="bonebuster-emf-chip"
			style={{
				position: "absolute",
				top: "calc(env(safe-area-inset-top, 0px) + 12px)",
				left: "50%",
				transform: "translateX(-50%)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 4,
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					fontFamily: FONT_FAMILY.display,
					fontSize: "var(--obx-hud-fs-label, 11px)",
					fontWeight: FONT_WEIGHT.regular,
					letterSpacing: LETTER_SPACING.hudLabel,
					color: RAMP[level - 1],
					textShadow: "0 0 4px rgba(0,0,0,0.7)",
				}}
			>
				EMF {level}
			</div>
			<div style={{ display: "flex", gap: 2 }}>
				{Array.from({ length: BAR_COUNT }, (_, i) => (
					<motion.div
						// biome-ignore lint/suspicious/noArrayIndexKey: `i` is the bar position (0..4) — stable for the lifetime of the component, never reordered.
						key={i}
						animate={{
							opacity: i < level ? 1 : 0.18,
							backgroundColor: i < level ? RAMP[i] : "#3a3a3a",
						}}
						transition={{ duration: 0.08 }}
						style={{
							width: 8,
							height: 14,
							borderRadius: 1,
						}}
					/>
				))}
			</div>
		</div>
	);
}
