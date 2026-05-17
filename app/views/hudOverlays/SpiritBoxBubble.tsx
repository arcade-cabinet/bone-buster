import { addBoneBusterListener } from "@engine/events";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * PC2 — Spirit-box HUD bubble.
 *
 * Subscribes to the `spiritBoxResponse` event dispatched from the
 * Scene's per-frame tick when a live enemy is within
 * SPIRIT_BOX_TRIGGER_RADIUS and the per-instance cooldown has
 * expired. Renders the dispatched phoneme just below the EMF chip
 * for ~1.6s, then fades. Multiple-in-flight bubbles are suppressed
 * — only the newest phoneme is shown (matches Phasmo's "one word
 * at a time" voice line cadence).
 *
 * Owner-gated upstream: the HUDOverlays aggregator mounts this slot
 * only when `state.hasSpiritBox` is true, so the listener cost is
 * zero for players who haven't picked up the box.
 *
 * Color: ROLE.accent.discovery (violet) — distinct from the EMF
 * chip's green/red ramp so the two readouts read as separate signal
 * sources, not the same instrument.
 */

const HOLD_MS = 1_600;

interface Bubble {
	id: number;
	phoneme: string;
}

export function SpiritBoxBubble() {
	const [bubble, setBubble] = useState<Bubble | null>(null);

	useEffect(() => {
		let counter = 0;
		let activeId = 0;
		// Track outstanding timer handles so unmount cancels them. The
		// `if (activeId === id)` guard inside the callback handles the
		// stale-state case; tracking handles avoids a fire-after-unmount
		// warning and a phantom setBubble queued behind the unmount.
		const pending = new Set<number>();
		const off = addBoneBusterListener("spiritBoxResponse", (evt) => {
			counter += 1;
			const id = counter;
			activeId = id;
			setBubble({ id, phoneme: evt.phoneme });
			const handle = window.setTimeout(() => {
				pending.delete(handle);
				// Only clear if a newer bubble hasn't replaced us — guards
				// against a fast-firing run dispatching two phonemes in
				// the HOLD_MS window (cooldown is 2.5s so this shouldn't
				// happen at the default tuning, but it's cheap defensive
				// code).
				if (activeId === id) setBubble(null);
			}, HOLD_MS);
			pending.add(handle);
		});
		return () => {
			off();
			for (const h of pending) window.clearTimeout(h);
			pending.clear();
		};
	}, []);

	return (
		<div
			data-testid="bonebuster-spirit-box-bubble"
			style={{
				position: "absolute",
				top: "calc(env(safe-area-inset-top, 0px) + 60px)",
				left: "50%",
				transform: "translateX(-50%)",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<AnimatePresence>
				{bubble && (
					<motion.div
						key={bubble.id}
						initial={{ opacity: 0, y: -8, scale: 0.9 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 8, scale: 0.95 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
						style={{
							padding: "6px 14px",
							borderRadius: 4,
							background: ROLE.bgPanelAlphaDark,
							border: `1px solid ${ROLE.signal.spiritBox}`,
							fontFamily: FONT_FAMILY.display,
							fontSize: "var(--obx-hud-fs-readout, 14px)",
							fontWeight: FONT_WEIGHT.regular,
							letterSpacing: LETTER_SPACING.display,
							color: ROLE.signal.spiritBox,
							textShadow: `0 0 4px ${ROLE.textShadowSoft}`,
						}}
					>
						{bubble.phoneme}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
