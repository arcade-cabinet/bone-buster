/**
 * POL35 — slow-mo timing bus.
 *
 * Single source of truth for sim-time scaling. Holds a small set of
 * named (id, scale, until) reservations and returns the COMBINED scale
 * as `min(all live scales)` so the most-pinched reservation always wins.
 *
 * Reservation lifecycle:
 *   reserve(id, scale, untilMs)  - install or replace by id
 *   release(id)                  - drop immediately
 *   getCombinedScale(nowMs)      - min over live (untilMs > nowMs)
 *
 * Live = strict inequality on `untilMs`, so an exactly-equal timestamp
 * is treated as just expired. Expired entries are never auto-pruned —
 * `getCombinedScale` skips them on read. Memory growth is bounded by
 * the `ReservationId` union size, so passive growth is safe.
 *
 * Source [x] item: POL22 (key-acquire slow-mo skipped pending bus).
 * Co-owner: POL12 (kill hitstop — ported to a reservation).
 */

export type ReservationId = "hitstop" | "key-acquire";

export interface TimeScaleBus {
	reserve(id: ReservationId, scale: number, untilMs: number): void;
	release(id: ReservationId): void;
	getCombinedScale(nowMs: number): number;
	clear(): void;
}

interface Reservation {
	scale: number;
	until: number;
}

export function createTimeScaleBus(): TimeScaleBus {
	const live = new Map<ReservationId, Reservation>();

	return {
		reserve(id, scale, untilMs) {
			live.set(id, { scale, until: untilMs });
		},
		release(id) {
			live.delete(id);
		},
		getCombinedScale(nowMs) {
			let minScale = 1;
			for (const r of live.values()) {
				if (r.until <= nowMs) continue;
				if (r.scale < minScale) minScale = r.scale;
			}
			return minScale;
		},
		clear() {
			live.clear();
		},
	};
}
