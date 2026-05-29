/**
 * HUD1 — classifyFrame leads with Capacitor Device info, viewport short edge as
 * the secondary signal. iOS classifies by model (iPad vs iPhone); android + web
 * classify by the live short edge (so an Android foldable flips on fold, and a
 * folded phone stays compact regardless of model string).
 */

import type { DeviceInfo } from "@capacitor/device";
import { COCKPIT_MIN_SHORT_EDGE, classifyFrame } from "@views/useFrameClass";
import { describe, expect, it } from "vitest";

const info = (platform: DeviceInfo["platform"], model = ""): DeviceInfo =>
	({ platform, model, operatingSystem: "unknown" }) as DeviceInfo;

describe("HUD1 — classifyFrame", () => {
	it("iOS: iPad model → cockpit, iPhone → compact, regardless of orientation", () => {
		// short edge is irrelevant on iOS — model decides.
		expect(classifyFrame(info("ios", "iPad13,4"), 400)).toBe("cockpit");
		expect(classifyFrame(info("ios", "iPad8,11"), 1024)).toBe("cockpit");
		expect(classifyFrame(info("ios", "iPhone15,3"), 932)).toBe("compact");
		expect(classifyFrame(info("ios", "iPhone13,4"), 390)).toBe("compact");
	});

	it("android: decided by the live viewport short edge (folded vs unfolded)", () => {
		// Pixel 5a / folded foldable → compact; unfolded foldable / tablet → cockpit.
		expect(classifyFrame(info("android", "Pixel 5a"), 393)).toBe("compact");
		expect(classifyFrame(info("android", "SM-F946"), 344)).toBe("compact"); // folded
		expect(classifyFrame(info("android", "SM-F946"), 840)).toBe("cockpit"); // unfolded
		expect(classifyFrame(info("android", "SM-X710"), 800)).toBe("cockpit"); // tab
	});

	it("web: viewport short edge — desktop → cockpit, mobile web → compact", () => {
		expect(classifyFrame(info("web"), 1080)).toBe("cockpit");
		expect(classifyFrame(info("web"), 500)).toBe("compact");
	});

	it("short-edge threshold is exact for the android/web branch", () => {
		expect(classifyFrame(info("web"), COCKPIT_MIN_SHORT_EDGE)).toBe("cockpit");
		expect(classifyFrame(info("web"), COCKPIT_MIN_SHORT_EDGE - 1)).toBe("compact");
	});
});
