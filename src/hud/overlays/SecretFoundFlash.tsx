import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "../../design-tokens";
import { addObjexoomListener } from "../../events";

/**
 * POL21 — modernized-DOOM secret-found ceremony. HUD overlay slot
 * (see docs/SLOT-ARCHITECTURE.md §1).
 *
 * On `secretTriggered`:
 *  - Brief screen flash (white at 0.12 opacity for 80ms, fade out
 *    over another 120ms) so the player feels the discovery moment.
 *  - Centered "SECRET FOUND" pulse card (amber on translucent ink,
 *    enters from below with spring bounce, holds 900ms, fades over
 *    300ms).
 *
 * The pulse card is centered horizontally + offset to 35% from top so
 * it doesn't overlap the HUD chrome or the win/death card surfaces.
 *
 * Returns null until the first event so canonical bytes stay stable
 * on day-zero runs.
 */
export function SecretFoundFlash() {
	const [activeKey, setActiveKey] = useState(0);

	useEffect(() => {
		return addObjexoomListener("secretTriggered", () => {
			setActiveKey((k) => k + 1);
		});
	}, []);

	if (activeKey === 0) return null;

	return (
		<>
			<motion.div
				key={`flash-${activeKey}`}
				style={{
					position: "absolute",
					inset: 0,
					background: "#ffffff",
					pointerEvents: "none",
					mixBlendMode: "screen",
				}}
				initial={{ opacity: 0.12 }}
				animate={{ opacity: 0 }}
				transition={{ duration: 0.2, ease: "easeOut" }}
			/>
			<motion.div
				key={`card-${activeKey}`}
				style={{
					position: "absolute",
					left: "50%",
					top: "35%",
					transform: "translate(-50%, -50%)",
					padding: "12px 28px",
					background: ROLE.bgPanelAlpha,
					border: `1px solid ${SCALE.amber[400]}`,
					borderRadius: 6,
					fontFamily: FONT_FAMILY.display,
					fontWeight: FONT_WEIGHT.bold,
					fontSize: 22,
					letterSpacing: LETTER_SPACING.display,
					color: SCALE.amber[200],
					textShadow: `0 0 12px ${SCALE.amber[500]}`,
					pointerEvents: "none",
				}}
				initial={{ opacity: 0, scale: 0.6, y: 18 }}
				animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.08, 1.0, 1.0], y: [18, 0, 0, -6] }}
				transition={{ duration: 1.2, times: [0, 0.18, 0.75, 1], ease: "easeOut" }}
			>
				✦ SECRET FOUND
			</motion.div>
		</>
	);
}
