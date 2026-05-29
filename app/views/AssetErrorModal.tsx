import { FONT_FAMILY, FONT_WEIGHT, LETTER_SPACING } from "@styles/tokens/index";
import type { AssetErrorReason } from "@views/AssetErrorBoundary";

/**
 * ERR1 — text-only asset-load error modal (arcade-cabinet parity). Rendered as a
 * DOM overlay above the (now-unmounted) Canvas when the AssetErrorBoundary
 * catches a load failure, so the player sees a clear failure instead of a silent
 * blank render. Text-only — no raw-HTML injection (CI-8); the URL/message
 * are rendered as React text nodes (auto-escaped).
 */
export function AssetErrorModal({ reason }: { reason: AssetErrorReason }) {
	return (
		<div
			data-testid="bonebuster-asset-error"
			role="alertdialog"
			aria-label="Asset load error"
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: "rgba(8, 6, 10, 0.92)",
				zIndex: 50,
				padding: "24px",
			}}
		>
			<div
				style={{
					maxWidth: 520,
					border: "1px solid #7a1f1f",
					borderRadius: 10,
					background: "linear-gradient(180deg, #1a1012 0%, #120c0e 100%)",
					boxShadow: "0 0 40px rgba(180, 30, 30, 0.35)",
					padding: "28px 32px",
					textAlign: "center",
					fontFamily: FONT_FAMILY.body,
					color: "#e8d8d4",
				}}
			>
				<div
					style={{
						fontFamily: FONT_FAMILY.display,
						fontWeight: FONT_WEIGHT.bold,
						fontSize: 22,
						letterSpacing: LETTER_SPACING.display,
						color: "#ff5a4d",
						marginBottom: 14,
					}}
				>
					ASSET FAILED TO LOAD
				</div>
				<p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.5, opacity: 0.9 }}>
					A required {reason.assetType} asset could not be loaded, so the level can't render.
				</p>
				<p
					style={{
						margin: "0 0 8px",
						fontFamily: FONT_FAMILY.mono,
						fontSize: 12,
						wordBreak: "break-all",
						opacity: 0.75,
						color: "#d8b0a8",
					}}
				>
					{reason.url}
				</p>
				<p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
					Reload the page to retry. If this persists, the deployment may be missing files.
				</p>
			</div>
		</div>
	);
}
