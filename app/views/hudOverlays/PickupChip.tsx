import { addBoneBusterListener } from "@engine/events";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "@styles/tokens/index";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * POL30 — pickup ceremony chip (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1).
 *
 * Listens for `pickupCollected` events and renders a 600ms transient
 * chip in the top-center of the screen. Each PickupKind has its own
 * label + palette so a new player learns what they just collected.
 * Keys route through POL22 KeyPickupCeremony instead.
 *
 * D3 — also listens for `weaponAcquired` (fires once per weapon per
 * session when ownedWeapons[X] flips false→true) and renders a
 * brighter beat in the weapon's accent palette. Co-located with the
 * pickup chip because they share the same screen real estate + the
 * same per-event setActive state; the brighten differentiation is
 * encoded per-spec via the `brighten: true` flag on the chip-spec.
 */

interface ChipSpec {
	readonly label: string;
	readonly fg: string;
	readonly bg: string;
	readonly glow: string;
	// D3 — first-time weapon-acquisition chips render with a wider
	// scale punch + a brighter ring so the beat reads as a discrete
	// "you just unlocked this" moment vs. the smaller ammo-collect
	// chip. Default false for pickup chips.
	readonly brighten?: boolean;
}

const CHIPS: Record<string, ChipSpec> = {
	health: {
		label: "HEALTH +1",
		fg: SCALE.ember[100],
		bg: SCALE.ember[500],
		glow: SCALE.ember[400],
	},
	flashlight: {
		label: "FLASHLIGHT",
		fg: SCALE.amber[100],
		bg: SCALE.amber[500],
		glow: SCALE.amber[400],
	},
	chaingunAmmo: {
		label: "CHAINGUN AMMO",
		fg: SCALE.indigo[100],
		bg: SCALE.indigo[600],
		glow: SCALE.indigo[400],
	},
	shotgunAmmo: {
		label: "SHOTGUN AMMO",
		fg: SCALE.violet[100],
		bg: SCALE.violet[600],
		glow: SCALE.violet[400],
	},
	flamethrowerAmmo: {
		label: "FLAMETHROWER AMMO",
		fg: SCALE.ember[100],
		bg: SCALE.blood[600],
		glow: SCALE.ember[300],
	},
	loot: {
		label: "TREASURE",
		fg: SCALE.amber[100],
		bg: SCALE.amber[600],
		glow: SCALE.amber[300],
	},
};

// D3 — weapon-acquired chips use the same palette family as the
// matching ammo chip but with the brighten flag set. Pistol/melee
// not included — both are baseOwnedWeapons defaults and never
// flip false→true, so the dispatch path can't reach them.
const WEAPON_CHIPS: Record<string, ChipSpec> = {
	chaingun: {
		label: "CHAINGUN ACQUIRED",
		fg: SCALE.indigo[50],
		bg: SCALE.indigo[600],
		glow: SCALE.indigo[300],
		brighten: true,
	},
	shotgun: {
		label: "SHOTGUN ACQUIRED",
		fg: SCALE.violet[50],
		bg: SCALE.violet[600],
		glow: SCALE.violet[300],
		brighten: true,
	},
	flamethrower: {
		label: "FLAMETHROWER ACQUIRED",
		fg: SCALE.ember[50],
		bg: SCALE.blood[600],
		glow: SCALE.ember[300],
		brighten: true,
	},
};

interface ActiveChip {
	readonly id: number;
	readonly spec: ChipSpec;
}

export function PickupChip() {
	const [active, setActive] = useState<ActiveChip | null>(null);

	useEffect(() => {
		let counter = 0;
		const offPickup = addBoneBusterListener("pickupCollected", ({ kind }) => {
			const spec = CHIPS[kind];
			if (!spec) return;
			counter += 1;
			setActive({ id: counter, spec });
		});
		// D3 — first-time weapon acquisition wins over a same-frame
		// ammo-collect chip (the weapon-acquired event fires from the
		// same setState callback that flips ownership). Last-write-wins
		// via setActive's natural ordering is correct here — the
		// brighten beat is the more important teach moment.
		const offWeapon = addBoneBusterListener("weaponAcquired", ({ weapon }) => {
			const spec = WEAPON_CHIPS[weapon];
			if (!spec) return;
			counter += 1;
			setActive({ id: counter, spec });
		});
		return () => {
			offPickup();
			offWeapon();
		};
	}, []);

	useEffect(() => {
		if (active === null) return;
		// D3 — weapon-acquired beats hold longer (the original 700ms
		// felt clipped on the brighter punch); pickup chips stay at the
		// original POL30 duration.
		const ttl = active.spec.brighten ? 1000 : 700;
		const t = window.setTimeout(() => setActive(null), ttl);
		return () => window.clearTimeout(t);
	}, [active]);

	return (
		<AnimatePresence>
			{active && (
				<motion.div
					key={active.id}
					style={{
						position: "absolute",
						left: "50%",
						top: "calc(80px + var(--obx-safe-top, 0px))",
						transform: "translateX(-50%)",
						// D3 — brighten chips render bigger + thicker for the
						// "you just unlocked a weapon" beat. Pickup chips stay
						// at the original POL30 sizing.
						padding: active.spec.brighten ? "12px 32px" : "8px 22px",
						background: `${active.spec.bg}${active.spec.brighten ? "e6" : "cc"}`,
						border: `${active.spec.brighten ? 2 : 1}px solid ${active.spec.glow}`,
						borderRadius: active.spec.brighten ? 8 : 6,
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: active.spec.brighten ? 18 : 14,
						letterSpacing: LETTER_SPACING.display,
						color: active.spec.fg,
						textShadow: active.spec.brighten
							? `0 0 18px ${active.spec.glow}, 0 0 32px ${active.spec.glow}99`
							: `0 0 10px ${active.spec.glow}aa`,
						pointerEvents: "none",
					}}
					initial={{
						opacity: 0,
						y: -16,
						scale: active.spec.brighten ? 0.7 : 0.85,
					}}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 12, scale: 0.95 }}
					transition={{ type: "spring", stiffness: 320, damping: 24 }}
				>
					{active.spec.label}
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// Keep ROLE available for consumers (no current consumer references
// the role tokens — palette is per-spec — but the import is the
// canonical entry point for HUD design tokens, so preserve it).
void ROLE;
