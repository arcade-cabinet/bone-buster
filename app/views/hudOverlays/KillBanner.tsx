import { pickEnemySkin } from "@assets/models";
import { addBoneBusterListener } from "@engine/events";
import type { EnemyKind } from "@engine/mapTypes";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

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
 * SLA4 — variant flavor names. Multi-skin rosters in `src/assets/models.ts`
 * carry an optional `flavorName` per non-canonical skin (e.g. JESTER →
 * CLOAKED, HEAP → MUSCULAR). The banner derives the variant from the
 * enemyId via `pickEnemySkin` and renders "BUSTED A <KIND> (<FLAVOR>)"
 * when the skin has a flavor; rosters without a flavor or single-skin
 * kinds keep the bare "BUSTED A <KIND>" output.
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

function bannerLabel(kind: string, flavor: string | null): string {
	const kindLabel = DISPLAY_NAMES[kind] ?? kind.toUpperCase();
	return flavor ? `BUSTED A ${kindLabel} (${flavor})` : `BUSTED A ${kindLabel}`;
}

const HOLD_MS = 900;
// Kills within this window stack into the same banner instead of
// re-mounting one banner per shot. 240ms = three frames at 12.5fps,
// covers a chaingun burst comfortably.
const STACK_WINDOW_MS = 240;

type Banner = { id: number; count: number; firstKind: string; firstFlavor: string | null };

export function KillBanner() {
	const [banner, setBanner] = useState<Banner | null>(null);

	useEffect(() => {
		// The "current in-flight banner" lives in this closure (not in a
		// useRef synced from React state) because shotgun blasts can fire
		// multiple `enemyKilled` events synchronously inside one frame —
		// React won't render between them, so a ref synced via
		// `ref.current = state` stays stale for every event after the
		// first. Closure-tracked state updates synchronously per event;
		// `setBanner` then publishes the running stack to React.
		let counter = 0;
		let lastTs = 0;
		let inFlight: Banner | null = null;

		const off = addBoneBusterListener("enemyKilled", (evt) => {
			const now = performance.now();
			if (inFlight && now - lastTs < STACK_WINDOW_MS) {
				lastTs = now;
				inFlight = {
					id: inFlight.id,
					count: inFlight.count + 1,
					firstKind: inFlight.firstKind,
					firstFlavor: inFlight.firstFlavor,
				};
				setBanner(inFlight);
				return;
			}
			counter += 1;
			lastTs = now;
			const skin = pickEnemySkin(evt.kind as EnemyKind, evt.enemyId);
			inFlight = {
				id: counter,
				count: 1,
				firstKind: evt.kind,
				firstFlavor: skin.flavorName ?? null,
			};
			setBanner(inFlight);
			// Clear the in-flight reference once the hold window expires so
			// the next kill after a quiet period opens a fresh banner.
			window.setTimeout(() => {
				if (inFlight && inFlight.id === counter) inFlight = null;
			}, HOLD_MS);
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
			: bannerLabel(banner.firstKind, banner.firstFlavor)
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
						color: ROLE.text.primary,
						textShadow: `0 0 10px ${ROLE.accent.warning}, 0 0 20px ${ROLE.accent.warning}66`,
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
