import { motion } from "framer-motion";

/**
 * POL26 — going-back klaxon overlay (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1). When `phase === "going_back"`:
 *
 *   - Animated diagonal red caution-stripes scroll across the top
 *     and bottom 14% of the screen on the X axis at 30 px/sec.
 *     mixBlendMode: screen so they don't obscure the game canvas.
 *   - Edge vignette pulses (radial gradient, blood[600] at 35% to
 *     transparent at 0%, peak opacity 0.45 → 0.15 → 0.45 over 1.4s
 *     loop). Reads as the room itself pulsing.
 *
 * All elements render as `motion.div` with infinite repeating
 * animations. Mount conditional on phase so when the player isn't
 * in going-back the elements are completely absent (canonical
 * bytes stay stable).
 */
export function GoingBackOverlay({ phase }: { phase: "out" | "going_back" }) {
	if (phase !== "going_back") return null;

	const stripePattern =
		"repeating-linear-gradient(135deg, rgba(220, 38, 38, 0.42) 0 14px, rgba(0, 0, 0, 0) 14px 28px)";

	return (
		<>
			<motion.div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: "14%",
					background: stripePattern,
					backgroundSize: "40px 40px",
					mixBlendMode: "screen",
					pointerEvents: "none",
				}}
				animate={{ backgroundPositionX: ["0px", "40px"] }}
				transition={{ duration: 1.3, ease: "linear", repeat: Infinity }}
			/>
			<motion.div
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					height: "14%",
					background: stripePattern,
					backgroundSize: "40px 40px",
					mixBlendMode: "screen",
					pointerEvents: "none",
				}}
				animate={{ backgroundPositionX: ["40px", "0px"] }}
				transition={{ duration: 1.3, ease: "linear", repeat: Infinity }}
			/>
			<motion.div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"radial-gradient(circle at center, rgba(0,0,0,0) 35%, rgba(153, 27, 27, 0.45) 100%)",
					mixBlendMode: "screen",
					pointerEvents: "none",
				}}
				animate={{ opacity: [0.6, 1, 0.6] }}
				transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
			/>
		</>
	);
}
