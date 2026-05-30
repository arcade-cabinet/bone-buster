import { prestigeTier } from "@store/runStats";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE } from "@styles/tokens/index";
import { motion } from "framer-motion";

/**
 * The HUD secondary-readout cluster: SCORE / SECRETS / PRESTIGE. Each is a
 * pop-in chip shown only when its value is non-zero; PRESTIGE derives from
 * levels-cleared via `prestigeTier` (STRUCT1 D23 — the endless run's only
 * progression marker, surfaced here + in the run-stats summary).
 *
 * Extracted from HUD.tsx as a pure presentational component (no 3D deps) so the
 * readout chips render-test in isolation without spinning a Canvas (review
 * QUAL-H1 / T-2 / T-5).
 */

const CHIP_STYLE = {
	marginTop: 4,
	fontFamily: FONT_FAMILY.display,
	fontSize: "var(--obx-hud-fs-readout, 14px)",
	fontWeight: FONT_WEIGHT.regular,
	letterSpacing: LETTER_SPACING.display,
} as const;

function ReadoutChip({
	testId,
	label,
	value,
	color,
}: {
	testId: string;
	label: string;
	value: number;
	color: string;
}) {
	return (
		<motion.div
			data-testid={testId}
			style={{ ...CHIP_STYLE, color }}
			key={value}
			initial={{ scale: 1.4 }}
			animate={{ scale: 1 }}
			transition={{ type: "spring", stiffness: 320, damping: 18 }}
		>
			{label} {value}
		</motion.div>
	);
}

export function RunReadout({
	score,
	secrets,
	levelsCleared,
}: {
	score: number;
	secrets: number;
	levelsCleared: number;
}) {
	const prestige = prestigeTier(levelsCleared);
	return (
		<>
			{score > 0 && (
				<ReadoutChip testId="bonebuster-score" label="SCORE" value={score} color={ROLE.actionKey} />
			)}
			{secrets > 0 && (
				<ReadoutChip
					testId="bonebuster-secrets"
					label="SECRETS"
					value={secrets}
					color={ROLE.actionKey}
				/>
			)}
			{prestige > 0 && (
				<ReadoutChip
					testId="bonebuster-prestige"
					label="PRESTIGE"
					value={prestige}
					color={ROLE.actionPickup}
				/>
			)}
		</>
	);
}
