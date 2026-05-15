import type { GameState, LevelPhase } from "../../ObjexoomShell";
import { GoingBackOverlay } from "./GoingBackOverlay";
import { KeyPickupCeremony } from "./KeyPickupCeremony";
import { MissionCompleteCeremony } from "./MissionCompleteCeremony";
import { PickupChip } from "./PickupChip";
import { SecretFoundFlash } from "./SecretFoundFlash";

/**
 * AUDIO3 / SLOT-ARCHITECTURE.md §1 — HUD overlay aggregator.
 *
 * Single mount point for all transient HUD overlays. Each child is a
 * self-contained slot that listens for its trigger event (or reads a
 * phase prop) and renders its own animation. Adding a new overlay is
 * a one-file new module plus a one-line import + JSX addition here.
 *
 * Currently registered slots:
 *   - SecretFoundFlash         (event: secretTriggered)          POL21
 *   - KeyPickupCeremony        (event: keyPickedUp)              POL22
 *   - GoingBackOverlay         (state: phase === "going_back")   POL26
 *   - MissionCompleteCeremony  (state: status === "won")         PT1B
 */
export function HUDOverlays({
	phase,
	state,
	onReturnToMenu,
}: {
	phase: LevelPhase;
	state: GameState;
	onReturnToMenu: () => void;
}) {
	return (
		<>
			<SecretFoundFlash />
			<KeyPickupCeremony />
			<PickupChip />
			<GoingBackOverlay phase={phase} />
			<MissionCompleteCeremony state={state} onReturnToMenu={onReturnToMenu} />
		</>
	);
}
