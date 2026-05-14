#!/usr/bin/env bash
# N1 — publish OBJEXOOM screenshots from test-results into docs.
#
# Usage:
#   pnpm test:e2e:objexoom:screenshots && ./scripts/objexoom-publish-screenshots.sh
#
# Copies the 5 canonical screenshots produced by
# `tests/e2e/objexoom-screenshots.spec.ts` into `docs/assets/objexoom/`
# so the EASTER_EGGS.md references stay current.
set -euo pipefail

SRC="test-results/objexoom-screenshots"
DST="docs/assets/objexoom"

if [ ! -d "$SRC" ]; then
	echo "missing $SRC — run pnpm test:e2e:objexoom:screenshots first" >&2
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
