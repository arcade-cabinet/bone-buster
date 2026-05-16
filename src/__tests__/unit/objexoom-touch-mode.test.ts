import { describe, expect, it, vi } from "vitest";
import { resolveTouchMode } from "../../ObjexoomShell";

describe("BC5 — resolveTouchMode", () => {
	it("'on' pins to true regardless of detection", () => {
		expect(resolveTouchMode("on", () => false)).toBe(true);
		expect(resolveTouchMode("on", () => true)).toBe(true);
	});

	it("'off' pins to false regardless of detection", () => {
		expect(resolveTouchMode("off", () => true)).toBe(false);
		expect(resolveTouchMode("off", () => false)).toBe(false);
	});

	it("'auto' delegates to the detect callback", () => {
		const detectTrue = vi.fn(() => true);
		const detectFalse = vi.fn(() => false);
		expect(resolveTouchMode("auto", detectTrue)).toBe(true);
		expect(resolveTouchMode("auto", detectFalse)).toBe(false);
		expect(detectTrue).toHaveBeenCalledTimes(1);
		expect(detectFalse).toHaveBeenCalledTimes(1);
	});
});
