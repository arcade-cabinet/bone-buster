import { Device, type DeviceInfo } from "@capacitor/device";
import { useEffect, useState } from "react";

/**
 * HUD1 — viewport/device class for the scene frame. The chrome "cockpit" border
 * reads well on big devices (tablets, unfolded foldables, desktop) where there's
 * room; it boxes in an already-small phone. So:
 *   - "cockpit" — tablet / unfolded foldable / desktop: full chrome frame.
 *   - "compact" — phone (portrait or landscape): subtle vignette only.
 *
 * Classification LEADS with Capacitor `Device.getInfo()` (the real device), not
 * a raw pixel ratio:
 *   - iOS: an `iPad*` model is unambiguously a tablet → cockpit; any `iPhone*`
 *     is a phone → compact, regardless of orientation.
 *   - web: there's no native device — desktop browsers get the cockpit, mobile
 *     web stays compact, decided by the viewport short edge.
 *   - Android: device model strings are not a reliable tablet signal (no
 *     `iPad`-like convention, and foldables fold/unfold at runtime), so we use
 *     the live viewport SHORT edge — the one case where the screen geometry IS
 *     the right signal because a folded phone and an unfolded foldable are the
 *     SAME device and only differ by panel size.
 */
export type FrameClass = "cockpit" | "compact";

/** Short-edge px at/above which a screen is "big enough" for the cockpit. */
export const COCKPIT_MIN_SHORT_EDGE = 700;

/**
 * Pure classifier — takes the resolved Capacitor device info + the current
 * viewport short edge. Kept pure (no window/Device reads) so it's unit-tested
 * across the iOS/Android/web branches without mocking the native plugin.
 */
export function classifyFrame(info: DeviceInfo, shortEdge: number): FrameClass {
	if (info.platform === "ios") {
		// iPadOS reports `model` like "iPad13,4"; iPhone reports "iPhone…".
		return /ipad/i.test(info.model) ? "cockpit" : "compact";
	}
	// android + web: the live short edge is the right lever (Android tablets +
	// unfolded foldables + desktop windows clear the threshold; phones + folded
	// foldables + mobile-web don't). A foldable transitions class on fold.
	return shortEdge >= COCKPIT_MIN_SHORT_EDGE ? "cockpit" : "compact";
}

function currentShortEdge(): number {
	if (typeof window === "undefined") return COCKPIT_MIN_SHORT_EDGE; // SSR → cockpit
	return Math.min(window.innerWidth, window.innerHeight);
}

/**
 * Live frame class. Resolves the native device info once (async), then tracks
 * resize / orientation / fold so an Android foldable flips cockpit↔compact as
 * its panel changes. Starts from the synchronous viewport read so there's no
 * frame of "wrong" frame before getInfo resolves.
 */
export function useFrameClass(): FrameClass {
	const [info, setInfo] = useState<DeviceInfo | null>(null);
	const [shortEdge, setShortEdge] = useState<number>(currentShortEdge);

	useEffect(() => {
		let cancelled = false;
		void Device.getInfo()
			.then((i) => {
				if (!cancelled) setInfo(i);
			})
			.catch(() => {
				/* getInfo can't fail on supported platforms; fall back to viewport-only */
			});
		if (typeof window === "undefined") return;
		const onResize = () => setShortEdge(currentShortEdge());
		window.addEventListener("resize", onResize);
		window.addEventListener("orientationchange", onResize);
		return () => {
			cancelled = true;
			window.removeEventListener("resize", onResize);
			window.removeEventListener("orientationchange", onResize);
		};
	}, []);

	// Until getInfo resolves, treat as web (viewport-only) — correct for desktop
	// web (the common case) and only momentarily off for an iPad first paint.
	const effectiveInfo: DeviceInfo =
		info ?? ({ platform: "web", model: "", operatingSystem: "unknown" } as DeviceInfo);
	return classifyFrame(effectiveInfo, shortEdge);
}
