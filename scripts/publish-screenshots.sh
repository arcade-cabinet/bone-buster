#!/usr/bin/env bash
# N1 — publish the canonical screenshots from test-results into docs.
#
# Usage:
#   pnpm test:e2e:screenshots && ./scripts/publish-screenshots.sh
#
# Copies the 5 canonical screenshots produced by
# `tests/e2e/screenshots.spec.ts` into `docs/assets/objexoom/` so the doc
# references stay current. (The test-results + docs dirs keep the historical
# `objexoom` name; renaming them is a separate asset-path migration.)
set -euo pipefail

SRC="test-results/objexoom-screenshots"
DST="docs/assets/objexoom"

if [ ! -d "$SRC" ]; then
	echo "missing $SRC — run pnpm test:e2e:screenshots first" >&2
	exit 1
fi

mkdir -p "$DST"

for name in landing.png ingame-flashlight-on.png ingame-flashlight-off.png going-back-strobe.png mission-complete.png; do
	if [ ! -f "$SRC/$name" ]; then
		echo "missing $SRC/$name — did the spec succeed?" >&2
		exit 1
	fi
	cp "$SRC/$name" "$DST/$name"
	echo "published $DST/$name"
done

# Keep the legacy filenames pointing at the new canonical shots so
# pre-Phase-2 doc links still resolve.
cp "$DST/ingame-flashlight-on.png" "$DST/ingame.png"
cp "$DST/mission-complete.png" "$DST/level-complete.png"

echo
echo "All 5 N1 screenshots published to $DST."
