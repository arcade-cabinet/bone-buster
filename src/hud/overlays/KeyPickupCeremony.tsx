import { addObjexoomListener } from "@engine/events";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "../../design-tokens";

/**
 * POL22 — key pickup ceremony (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1).
 *
 * On `keyPickedUp`:
 *  - Gold-amber screen vignette flashes in then fades (mixBlendMode
 *    screen, peak opacity 0.18 over 200ms then 600ms fade).
 *  - Centered "KEY ACQUIRED" pulse card enters from below with
 *    spring bounce, holds, then exits up.
 *
 * The 3D spinning HUD key (HudKey3D, mounted permanently while
 * hasKey is true) handles the persistent indicator; this slot
 * handles the discovery moment.
 */
export function KeyPickupCeremony() {
	const [activeKey, setActiveKey] = useState(0);

	useEffect(() => {
		return addObjexoomListener("keyPickedUp", () => {
			setActiveKey((k) => k + 1);
		});
	}, []);

	if (activeKey === 0) return null;

	return (
		<>
			<motion.div
				key={`vignette-${activeKey}`}
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at center, rgba(245, 158, 11, 0) 35%, rgba(245, 158, 11, 0.45) 100%)",
					pointerEvents: "none",
					mixBlendMode: "screen",
				}}
				initial={{ opacity: 0 }}
				animate={{ opacity: [0, 0.18, 0] }}
				transition={{ duration: 0.8, times: [0, 0.25, 1], ease: "easeOut" }}
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
					fontSize: 24,
					letterSpacing: LETTER_SPACING.display,
					color: SCALE.amber[100],
					textShadow: `0 0 14px ${SCALE.amber[500]}, 0 0 4px ${SCALE.amber[300]}`,
					pointerEvents: "none",
				}}
				initial={{ opacity: 0, scale: 0.55, y: 22 }}
				animate={{
					opacity: [0, 1, 1, 0],
					scale: [0.55, 1.12, 1.0, 1.0],
					y: [22, 0, 0, -10],
				}}
				transition={{ duration: 1.3, times: [0, 0.16, 0.78, 1], ease: "easeOut" }}
			>
				KEY ACQUIRED
			</motion.div>
		</>
	);
}
