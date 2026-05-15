import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING, ROLE, SCALE } from "../../design-tokens";
import { addObjexoomListener } from "../../events";

/**
 * POL30 — pickup ceremony chip (HUD overlay slot per
 * docs/SLOT-ARCHITECTURE.md §1).
 *
 * Listens for `pickupCollected` events and renders a 600ms transient
 * chip in the top-center of the screen. Each PickupKind has its own
 * label + palette so a new player learns what they just collected.
 * Keys route through POL22 KeyPickupCeremony instead.
 */

interface ChipSpec {
	readonly label: string;
	readonly fg: string;
	readonly bg: string;
	readonly glow: string;
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
	loot: {
		label: "TREASURE",
		fg: SCALE.amber[100],
		bg: SCALE.amber[600],
		glow: SCALE.amber[300],
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
		return addObjexoomListener("pickupCollected", ({ kind }) => {
			const spec = CHIPS[kind];
			if (!spec) return;
			counter += 1;
			setActive({ id: counter, spec });
		});
	}, []);

	useEffect(() => {
		if (active === null) return;
		const t = window.setTimeout(() => setActive(null), 700);
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
						top: 80,
						transform: "translateX(-50%)",
						padding: "8px 22px",
						background: `${active.spec.bg}cc`,
						border: `1px solid ${active.spec.glow}`,
						borderRadius: 6,
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 14,
						letterSpacing: LETTER_SPACING.display,
						color: active.spec.fg,
						textShadow: `0 0 10px ${active.spec.glow}aa`,
						pointerEvents: "none",
					}}
					initial={{ opacity: 0, y: -16, scale: 0.85 }}
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
