import { addBoneBusterListener } from "@engine/events";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, SCALE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * PB2 — non-boss enemy-kill HUD banner (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1). Sibling to `BossBanner` — when a
 * non-boss enemy's HP crosses ≤0 the engine dispatches `enemyKilled`
 * and this overlay shows "BUSTED A <KIND>" briefly. Quick kills stack
 * into "BUSTED N" instead of spamming individual cards.
 *
 * Boss kills keep their own `bossDefeated` event + `BossBanner`
 * surface — that beat is the celebratory ✦ card, distinct from the
 * per-mob ticker.
 *
 * Variant flavor names are deliberately NOT in scope yet (the PRD
 * §Parked entry suggested e.g. "PLAGUEBEAK (STAINED-CASSOCK)" but
 * variant identity is picked at render-time in the GLB loader and
 * isn't on the Enemy record — that plumbing is its own slice).
 */

const DISPLAY_NAMES: Record<string, string> = {
	rattler: "RATTLER",
	phaser: "PHASER",
	bouncer: "BOUNCER",
	plaguebeak: "PLAGUEBEAK",
	jester: "JESTER",
	reverend: "REVEREND",
	stagged: "STAGGED",
	grub: "GRUB",
	signal: "SIGNAL",
	heap: "HEAP",
	heap2: "HEAP",
	gorehead: "GOREHEAD",
	bighoss: "BIGHOSS",
	stomper: "STOMPER",
	butcher: "BUTCHER",
	bloodphaser: "BLOODPHASER",
	devil: "DEVIL",
	dolly: "DOLLY",
	gawker: "GAWKER",
	oneye: "ONEYE",
	goliath: "GOLIATH",
	swiney: "SWINEY",
	mrZ: "MR. Z",
	lupin: "LUPIN",
};

const HOLD_MS = 900;
// Kills within this window stack into the same banner instead of
// re-mounting one banner per shot. 240ms = three frames at 12.5fps,
// covers a chaingun burst comfortably.
const STACK_WINDOW_MS = 240;

type Banner = { id: number; count: number; firstKind: string };

export function KillBanner() {
	const [banner, setBanner] = useState<Banner | null>(null);
	const bannerRef = useRef<Banner | null>(null);
	bannerRef.current = banner;

	useEffect(() => {
		let counter = 0;
		let lastTs = 0;

		const off = addBoneBusterListener("enemyKilled", (evt) => {
			const now = performance.now();
			const current = bannerRef.current;
			if (current && now - lastTs < STACK_WINDOW_MS) {
				lastTs = now;
				setBanner({ id: current.id, count: current.count + 1, firstKind: current.firstKind });
				return;
			}
			counter += 1;
			lastTs = now;
			setBanner({ id: counter, count: 1, firstKind: evt.kind });
		});
		return off;
	}, []);

	useEffect(() => {
		if (banner === null) return;
		const t = window.setTimeout(() => setBanner(null), HOLD_MS);
		return () => window.clearTimeout(t);
	}, [banner]);

	const label = banner
		? banner.count > 1
			? `BUSTED ${banner.count}`
			: `BUSTED A ${DISPLAY_NAMES[banner.firstKind] ?? banner.firstKind.toUpperCase()}`
		: "";

	return (
		<AnimatePresence>
			{banner && (
				<motion.div
					key={banner.id}
					style={{
						position: "absolute",
						left: "50%",
						bottom: "22%",
						transform: "translate(-50%, 0)",
						padding: "8px 20px",
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 22,
						letterSpacing: LETTER_SPACING.display,
						color: SCALE.amber[100],
						textShadow: `0 0 10px ${SCALE.amber[500]}, 0 0 20px ${SCALE.amber[700]}aa`,
						pointerEvents: "none",
					}}
					initial={{ opacity: 0, y: 12, scale: 0.85 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: -8, scale: 1.05 }}
					transition={{ type: "spring", stiffness: 320, damping: 22 }}
				>
					{label}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
