import { dispatch } from "@engine/events";
import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * ERR1 — error boundary around the scene `<Canvas>`. drei's `useGLTF` /
 * `useTexture` throw on a failed load; the throw suspends, and when the promise
 * REJECTS it propagates up as a render error. Without a boundary React unmounts
 * the whole subtree → a silent blank canvas (review BP-6). This catches it,
 * emits `bonebuster:assetError` (so verify-pages-deploy can assert zero asset
 * errors — CI-10), and hands the reason up via `onError` so the Shell can show
 * a text-only error modal (no raw-HTML injection — CI-8).
 *
 * It renders `null` on error (the Canvas is gone); the visible modal is a DOM
 * sibling in the Shell, driven by the lifted error state.
 */

/** Best-effort asset-class + URL extraction from a thrown load error. */
function classify(error: unknown): { url: string; assetType: AssetErrorClass } {
	const message = error instanceof Error ? error.message : String(error);
	// drei/three load errors embed the URL; grab the first http(s) or /-rooted
	// token. Stop at whitespace, quotes, AND `:` so a trailing `: 404` status
	// suffix isn't captured into the URL (which would break the extension match).
	const urlMatch = message.match(/(https?:\/\/[^\s)'":]+|\/[\w\-./]+\.\w+)/);
	const url = urlMatch?.[0] ?? "unknown";
	const lower = url.toLowerCase();
	// Match the extension allowing a trailing query/fragment (`?v=…`, `#…`).
	const extOf = (re: RegExp) => re.test(lower);
	const assetType: AssetErrorClass = extOf(/\.glb($|[?#])/)
		? "glb"
		: extOf(/\.wasm($|[?#])/)
			? "wasm"
			: extOf(/\.(png|jpg|jpeg|webp|ktx2?)($|[?#])/)
				? "texture"
				: extOf(/\.(woff2?|ttf|otf)($|[?#])/)
					? "font"
					: "unknown";
	return { url, assetType };
}

type AssetErrorClass = "glb" | "texture" | "wasm" | "font" | "unknown";

export type AssetErrorReason = { url: string; assetType: AssetErrorClass; message: string };

type Props = {
	children: ReactNode;
	/** Lifted so the Shell can render the DOM-level modal. */
	onError: (reason: AssetErrorReason) => void;
};

type State = { hasError: boolean };

export class AssetErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false };

	static getDerivedStateFromError(): State {
		return { hasError: true };
	}

	componentDidCatch(error: Error, _info: ErrorInfo): void {
		const { url, assetType } = classify(error);
		// CI-10 — observable asset-failure signal for the deploy smoke test.
		dispatch({ type: "assetError", url, assetType, phase: "scene" });
		this.props.onError({ url, assetType, message: error.message });
	}

	render(): ReactNode {
		if (this.state.hasError) return null;
		return this.props.children;
	}
}
