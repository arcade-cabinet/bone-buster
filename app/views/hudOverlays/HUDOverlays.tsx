import type { GameState, LevelPhase } from "@store/gameState";
import type { Difficulty } from "@store/settings";
import { BossBanner } from "@views/hudOverlays/BossBanner";
import { DifficultyChip } from "@views/hudOverlays/DifficultyChip";
import { EmfChip } from "@views/hudOverlays/EmfChip";
import { GoingBackOverlay } from "@views/hudOverlays/GoingBackOverlay";
import { KeyPickupCeremony } from "@views/hudOverlays/KeyPickupCeremony";
import { KillBanner } from "@views/hudOverlays/KillBanner";
import { MissionCompleteCeremony } from "@views/hudOverlays/MissionCompleteCeremony";
import { PauseOverlay } from "@views/hudOverlays/PauseOverlay";
import { PickupChip } from "@views/hudOverlays/PickupChip";
import { SecretFoundFlash } from "@views/hudOverlays/SecretFoundFlash";
import { SpiritBoxBubble } from "@views/hudOverlays/SpiritBoxBubble";

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
 *   - DifficultyChip           (prop:  runId advances)           POL31
 *   - PauseOverlay             (state: status === "paused")      POL34
 *   - BossBanner               (event: bossSpotted/bossDefeated) POL36
 *   - KillBanner                (event: enemyKilled, non-boss)   PB2
 *   - EmfChip                   (event: emfReading, owner-gated) PB5
 *   - SpiritBoxBubble           (event: spiritBoxResponse, owner-gated) PC2
 */
export function HUDOverlays({
	phase,
	state,
	difficulty,
	runId,
	onReturnToMenu,
	onResume,
	onQuit,
}: {
	phase: LevelPhase;
	state: GameState;
	difficulty: Difficulty;
	runId: number;
	onReturnToMenu: () => void;
	onResume: () => void;
	onQuit: () => void;
}) {
	return (
		<>
			<SecretFoundFlash />
			<KeyPickupCeremony />
			<PickupChip />
			<DifficultyChip difficulty={difficulty} runId={runId} />
			<GoingBackOverlay phase={phase} deadlineMs={state.goingBackDeadlineMs} />
			<PauseOverlay
				state={state}
				onResume={onResume}
				onReturnToLanding={onReturnToMenu}
				onQuit={onQuit}
			/>
			<MissionCompleteCeremony state={state} onReturnToMenu={onReturnToMenu} />
			<BossBanner />
			<KillBanner />
			{state.hasEmfReader && <EmfChip />}
			{state.hasSpiritBox && <SpiritBoxBubble />}
		</>
	);
}
