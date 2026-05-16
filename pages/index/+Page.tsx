/**
 * Root page — the entire Bone Buster game lives inside <BoneBusterShell>.
 *
 * Vike imports this and hands it to `/pages/+onRenderClient.tsx` as
 * `pageContext.Page`. There's no per-route data loading and no other
 * routes; the Shell's own state machine handles landing → in-game →
 * mission-complete transitions.
 */

import { BoneBusterShell } from "@views/Shell";

export default function Page() {
	return <BoneBusterShell />;
}
