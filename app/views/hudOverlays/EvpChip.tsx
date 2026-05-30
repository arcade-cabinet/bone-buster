import { addBoneBusterListener } from "@engine/events";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * GH-TAPE — EVP tape-recorder playback chip.
 *
 * Subscribes to the `evpCaptured` event the Scene tick fires when a live enemy
 * comes within EVP_CAPTURE_RADIUS (the recorder is always-on, so this mounts
 * unconditionally — no owner gate, unlike the EMF/spirit-box chips). Renders the
 * captured residue cue as a "▸ REC" playback line for ~2s, then fades. Newest
 * capture replaces any in-flight one.
 *
 * Color: ROLE.signal.spiritBox family but with a "recorded" framing (the ▸ REC
 * prefix + monospace) so it reads as captured tape, distinct from the live
 * spirit-box voice line.
 */

const HOLD_MS = 2_000;

interface Capture {
	id: number;
	cue: string;
}

export function EvpChip() {
	const [capture, setCapture] = useState<Capture | null>(null);

	useEffect(() => {
		let mounted = true;
		let counter = 0;
		let activeId = 0;
		const pending = new Set<number>();
		const off = addBoneBusterListener("evpCaptured", (evt) => {
			if (!mounted) return;
			counter += 1;
			const id = counter;
			activeId = id;
			setCapture({ id, cue: evt.cue });
			const handle = window.setTimeout(() => {
				pending.delete(handle);
				if (mounted && activeId === id) setCapture(null);
			}, HOLD_MS);
			pending.add(handle);
		});
		return () => {
			mounted = false;
			off();
			for (const h of pending) window.clearTimeout(h);
			pending.clear();
		};
	}, []);

	return (
		<div
			data-testid="bonebuster-evp-chip"
			style={{
				position: "absolute",
				top: "calc(env(safe-area-inset-top, 0px) + 100px)",
				left: "50%",
				transform: "translateX(-50%)",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<AnimatePresence>
				{capture && (
					<motion.div
						key={capture.id}
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 6 }}
						transition={{ duration: 0.22, ease: "easeOut" }}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "5px 12px",
							borderRadius: 4,
							background: ROLE.bgPanelAlphaDark,
							border: `1px solid ${ROLE.signal.spiritBox}`,
							fontFamily: FONT_FAMILY.mono,
							fontSize: "var(--obx-hud-fs-readout, 13px)",
							fontWeight: FONT_WEIGHT.regular,
							letterSpacing: LETTER_SPACING.body,
							color: ROLE.signal.spiritBox,
							textShadow: `0 0 4px ${ROLE.textShadowSoft}`,
						}}
					>
						<span
							style={{
								fontFamily: FONT_FAMILY.display,
								fontSize: 10,
								opacity: 0.7,
								letterSpacing: LETTER_SPACING.display,
							}}
						>
							▸ EVP
						</span>
						{capture.cue}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
