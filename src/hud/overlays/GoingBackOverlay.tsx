import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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
 *   - PT4B — on the FIRST going_back transition per mount, a
 *     transient "RETURN TO SPAWN" directive card fades in 500ms
 *     after the phase flips, holds 2 seconds, then fades out
 *     800ms. This is the one-shot teach moment for new players —
 *     the chevrons are the persistent klaxon, this card is the
 *     directive that tells them WHERE to go.
 *
 * All elements render as `motion.div` with infinite repeating
 * animations. Mount conditional on phase so when the player isn't
 * in going-back the elements are completely absent (canonical
 * bytes stay stable).
 */
export function GoingBackOverlay({ phase }: { phase: "out" | "going_back" }) {
	const [showDirective, setShowDirective] = useState(false);
	useEffect(() => {
		if (phase !== "going_back") {
			setShowDirective(false);
			return;
		}
		// Delay 500ms so the chevrons + vignette establish first,
		// then the card fades in over its own 0.5s entry.
		const t1 = window.setTimeout(() => setShowDirective(true), 500);
		// Hold 2 seconds visible, then 800ms fade-out (handled by
		// AnimatePresence-style key change → we just flip back to
		// false at 500 + 500 + 2000 = 3000ms).
		const t2 = window.setTimeout(() => setShowDirective(false), 3300);
		return () => {
			window.clearTimeout(t1);
			window.clearTimeout(t2);
		};
	}, [phase]);

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
			{showDirective && (
				<motion.div
					style={{
						position: "absolute",
						left: "50%",
						top: "35%",
						transform: "translate(-50%, -50%)",
						padding: "14px 30px",
						background: "rgba(15, 7, 7, 0.78)",
						border: "1px solid rgba(248, 113, 113, 0.55)",
						borderRadius: 6,
						fontFamily: "'Black Ops One', 'Press Start 2P', system-ui, monospace",
						fontWeight: 400,
						fontSize: 22,
						letterSpacing: "0.18em",
						color: "rgba(254, 226, 226, 0.95)",
						textShadow: "0 0 14px rgba(220, 38, 38, 0.85), 0 0 4px rgba(254, 202, 202, 0.7)",
						pointerEvents: "none",
					}}
					initial={{ opacity: 0, scale: 0.85, y: 12 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: -8 }}
					transition={{ type: "spring", stiffness: 260, damping: 22 }}
				>
					RETURN TO SPAWN
				</motion.div>
			)}
		</>
	);
}
