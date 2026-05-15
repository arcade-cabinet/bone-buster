import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "../../design-tokens";
import { DIFFICULTY_LABEL, type Difficulty } from "../../settings";

/**
 * POL31 — difficulty acknowledgment chip (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1).
 *
 * Receives the chosen difficulty + a monotonic `runId` prop. Whenever
 * `runId` advances (a new run started — NEW GAME or RESUME), the chip
 * fires a 2-second transient acknowledgment in the difficulty's
 * associated palette: cool indigo at the easy end, hot blood-red at
 * NIGHTMARE.
 *
 * Driven by prop instead of event because the HUD subtree mounts
 * AFTER the landing→playing transition (AnimatePresence mode="wait"
 * adds a 350ms exit animation), so an event dispatched at transition
 * time would fire before the listener exists. Prop-driven mount is
 * race-free: the new HUD subtree reads the current runId on first
 * render and triggers the chip in its own first effect.
 */

interface ChipSpec {
	readonly fg: string;
	readonly bg: string;
	readonly glow: string;
	readonly border: string;
}

const CHIPS: Record<Difficulty, ChipSpec> = {
	tooYoung: {
		fg: SCALE.indigo[50],
		bg: SCALE.indigo[700],
		glow: SCALE.indigo[400],
		border: SCALE.indigo[300],
	},
	notTooRough: {
		fg: SCALE.parchment[50],
		bg: SCALE.indigo[600],
		glow: SCALE.indigo[300],
		border: SCALE.indigo[200],
	},
	hurtMePlenty: {
		fg: SCALE.amber[50],
		bg: SCALE.amber[600],
		glow: SCALE.amber[300],
		border: SCALE.amber[200],
	},
	ultraViolence: {
		fg: SCALE.ember[50],
		bg: SCALE.ember[600],
		glow: SCALE.ember[300],
		border: SCALE.ember[200],
	},
	nightmare: {
		fg: SCALE.blood[50],
		bg: SCALE.blood[600],
		glow: SCALE.blood[400],
		border: SCALE.blood[300],
	},
};

export function DifficultyChip({ difficulty, runId }: { difficulty: Difficulty; runId: number }) {
	const [shown, setShown] = useState(false);

	useEffect(() => {
		// Skip the boot-time runId=0 — there's no "current run" yet so we
		// shouldn't surface the chip before the player has clicked NEW
		// GAME / RESUME. Every subsequent monotonic bump (1, 2, 3, …)
		// fires the 2-second acknowledgment.
		if (runId === 0) return;
		setShown(true);
		const t = window.setTimeout(() => setShown(false), 2000);
		return () => window.clearTimeout(t);
	}, [runId]);

	const spec = CHIPS[difficulty];

	return (
		<AnimatePresence>
			{shown && (
				<motion.div
					key={runId}
					style={{
						position: "absolute",
						left: "50%",
						top: 140,
						transform: "translateX(-50%)",
						padding: "10px 28px",
						background: `${spec.bg}d0`,
						border: `1px solid ${spec.border}`,
						borderRadius: 8,
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 18,
						letterSpacing: LETTER_SPACING.display,
						color: spec.fg,
						textShadow: `0 0 14px ${spec.glow}cc`,
						pointerEvents: "none",
						whiteSpace: "nowrap",
					}}
					initial={{ opacity: 0, y: -20, scale: 0.8 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 8, scale: 0.95 }}
					transition={{ type: "spring", stiffness: 280, damping: 22 }}
				>
					{DIFFICULTY_LABEL[difficulty]}
				</motion.div>
			)}
		</AnimatePresence>
	);
}

void ROLE;
