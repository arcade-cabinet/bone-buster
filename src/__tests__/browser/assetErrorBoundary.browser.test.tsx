/**
 * ERR1 — AssetErrorBoundary contract (real Chromium).
 *
 * Pins: when a child throws a load-style error, the boundary (1) renders null
 * (the Canvas is gone), (2) calls `onError` with a classified {url, assetType,
 * message}, and (3) dispatches a `bonebuster:assetError` event carrying the same
 * url/type — the signal verify-pages-deploy asserts on (CI-10). Drives the throw
 * with a child that throws on first render (the same shape a rejected useGLTF
 * Suspense load surfaces as).
 */

import { addBoneBusterListener, type EventOf } from "@engine/events";
import { cleanup, render, screen } from "@testing-library/react";
import { AssetErrorBoundary, type AssetErrorReason } from "@views/AssetErrorBoundary";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

function Boom({ message }: { message: string }): null {
	throw new Error(message);
}

describe("ERR1 — AssetErrorBoundary", () => {
	it("renders children when there is no error", () => {
		render(
			<AssetErrorBoundary onError={() => {}}>
				<div data-testid="ok-child">ok</div>
			</AssetErrorBoundary>,
		);
		expect(screen.getByTestId("ok-child")).toBeDefined();
	});

	it("on a child throw: renders null, calls onError, and emits bonebuster:assetError with a classified GLB url", () => {
		const events: EventOf<"assetError">[] = [];
		const off = addBoneBusterListener("assetError", (e) => events.push(e));
		const onError = vi.fn<(r: AssetErrorReason) => void>();

		const { container } = render(
			<AssetErrorBoundary onError={onError}>
				<Boom message="Could not load https://localhost/assets/models/enemies/skeleton.glb: 404" />
			</AssetErrorBoundary>,
		);

		// (1) rendered null — no child markup survived.
		expect(container.querySelector("[data-testid]")).toBeNull();

		// (2) onError called with the classified reason.
		expect(onError).toHaveBeenCalledTimes(1);
		const reason = onError.mock.calls[0]?.[0];
		expect(reason?.assetType).toBe("glb");
		expect(reason?.url).toBe("https://localhost/assets/models/enemies/skeleton.glb");

		// (3) the observable event fired with the same url/type.
		expect(events).toHaveLength(1);
		expect(events[0]?.assetType).toBe("glb");
		expect(events[0]?.url).toContain("skeleton.glb");
		expect(events[0]?.phase).toBe("scene");

		off();
	});

	it("classifies a wasm failure", () => {
		const onError = vi.fn<(r: AssetErrorReason) => void>();
		render(
			<AssetErrorBoundary onError={onError}>
				<Boom message="fetch failed: /assets/wasm/sql-wasm.wasm" />
			</AssetErrorBoundary>,
		);
		expect(onError.mock.calls[0]?.[0]?.assetType).toBe("wasm");
	});
});
