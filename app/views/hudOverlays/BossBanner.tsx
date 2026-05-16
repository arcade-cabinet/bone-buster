import { addBoneBusterListener } from "@engine/events";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, SCALE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * POL36 — boss HUD banner (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1).
 *
 * Listens for two events:
 *   bossSpotted  — first line-of-sight to a tier="boss" enemy → "⚠ BOSS APPROACHES"
 *   bossDefeated — kill of a tier="boss" enemy → "✦ BOSS DEFEATED"
 *
 * Both render as centered stencil cards with spring-eased entry,
 * 1.2s hold, then fade. Distinct palettes so the spotted vs defeated
 * beats read separately — spotted is alarm-red (blood[300]), defeated
 * is celebratory-amber (amber[200]). POL10-v2's existing boss-death
 * audio sting carries the audio half; this overlay only gates HUD.
 */

type Beat = { kind: "spotted" | "defeated"; id: number };

const SPECS = {
	spotted: {
		label: "⚠ BOSS APPROACHES",
		fg: SCALE.blood[200],
		glow: SCALE.blood[500],
	},
	defeated: {
		label: "✦ BOSS DEFEATED",
		fg: SCALE.amber[100],
		glow: SCALE.amber[400],
	},
} as const;

const HOLD_MS = 1200;

export function BossBanner() {
	const [active, setActive] = useState<Beat | null>(null);

	useEffect(() => {
		let counter = 0;
		const offSpotted = addBoneBusterListener("bossSpotted", () => {
			counter += 1;
			setActive({ kind: "spotted", id: counter });
		});
		const offDefeated = addBoneBusterListener("bossDefeated", () => {
			counter += 1;
			setActive({ kind: "defeated", id: counter });
		});
		return () => {
			offSpotted();
			offDefeated();
		};
	}, []);

	useEffect(() => {
		if (active === null) return;
		const t = window.setTimeout(() => setActive(null), HOLD_MS);
		return () => window.clearTimeout(t);
	}, [active]);

	return (
		<AnimatePresence>
			{active && (
				<motion.div
					key={active.id}
					style={{
						position: "absolute",
						left: "50%",
						top: "30%",
						transform: "translate(-50%, -50%)",
						padding: "12px 32px",
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 32,
						letterSpacing: LETTER_SPACING.display,
						color: SPECS[active.kind].fg,
						textShadow: `0 0 16px ${SPECS[active.kind].glow}, 0 0 32px ${SPECS[active.kind].glow}aa`,
						pointerEvents: "none",
					}}
					initial={{ opacity: 0, scale: 0.7 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 1.08 }}
					transition={{ type: "spring", stiffness: 240, damping: 20 }}
				>
					{SPECS[active.kind].label}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
