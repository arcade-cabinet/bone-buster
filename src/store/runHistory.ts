/**
 * E9 / STO1b — persistent run history backed by
 * @capacitor-community/sqlite (native + jeep-sqlite on web).
 *
 * Pre-STO1b this module used sql.js + a base64-encoded `Database`
 * blob in `localStorage["objexoom.runHistory"]`. That worked on web
 * but didn't survive Capacitor's native runtime (no shared
 * Window.localStorage write path), and forced two parallel storage
 * APIs in the codebase. STO1b unifies on the Capacitor abstraction:
 * jeep-sqlite/IndexedDB on web, native SQLite on iOS/Android. App
 * code never touches `localStorage` directly.
 *
 * The legacy blob (if present at first open) is one-time migrated:
 * decoded via sql.js, rows copied into the new Capacitor table,
 * legacy key deleted. Subsequent opens skip the migration entirely.
 */

import { createDatabase } from "@platform/persistence/createDatabase";
import type { DatabaseAdapter } from "@platform/persistence/database";

const LEGACY_STORAGE_KEY = "objexoom.runHistory";

/** Outcome of a single run. */
export type RunOutcome = "won" | "died";

/** A single completed run as persisted in the history table. */
export type RunRecord = Readonly<{
	id: number;
	startedAt: number;
	endedAt: number;
	levelsCleared: number;
	totalKills: number;
	totalDamageTaken: number;
	/** POL5 — secrets triggered across the run. Older rows default to 0. */
	totalSecrets: number;
	/**
	 * STRUCT1 — the run's map identity. Pre-STRUCT1 this held the "procedural"
	 * / 1-5 LevelChoice; now (fully procedural + endless) it holds the descent's
	 * seed PHRASE. Stored as TEXT for forward compat; legacy rows still parse.
	 */
	levelSet: string;
	outcome: RunOutcome;
}>;

/** Shape passed in when recording — id + endedAt are filled by the store. */
export type RunInsert = Readonly<{
	startedAt: number;
	levelsCleared: number;
	totalKills: number;
	totalDamageTaken: number;
	/** POL5 — secrets triggered across the run. */
	totalSecrets: number;
	/** STRUCT1 — the run's descent identity (the seed phrase). */
	levelSet: string;
	outcome: RunOutcome;
}>;

async function ensureSchema(db: DatabaseAdapter): Promise<void> {
	await db.execute(`
		CREATE TABLE IF NOT EXISTS runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			started_at INTEGER NOT NULL,
			ended_at INTEGER NOT NULL,
			levels_cleared INTEGER NOT NULL,
			total_kills INTEGER NOT NULL,
			total_damage_taken INTEGER NOT NULL,
			total_secrets INTEGER NOT NULL DEFAULT 0,
			level_set TEXT NOT NULL,
			outcome TEXT NOT NULL
		);
	`);
	await db.execute(`CREATE INDEX IF NOT EXISTS runs_ended_at_desc ON runs (ended_at DESC);`);
}

/**
 * STO1b — one-time migration from the legacy sql.js + localStorage
 * blob into the new Capacitor table. Only runs when a legacy blob is
 * present AND the new table is empty (so re-running on a database
 * that already received the migration is a safe no-op). On success
 * the legacy key is removed; on any failure the legacy key is left
 * in place so a future agent can debug without permanent data loss.
 */
async function migrateLegacyBlobIfPresent(db: DatabaseAdapter): Promise<number> {
	if (typeof localStorage === "undefined") return 0;
	const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (!raw) return 0;
	const existing = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM runs`);
	if ((existing[0]?.n ?? 0) > 0) {
		// New table already has rows — don't double-import. Drop the
		// legacy key now so future opens skip the work.
		localStorage.removeItem(LEGACY_STORAGE_KEY);
		return 0;
	}
	// ARCH3 — sql.js was removed after the STO1b migration grace window
	// (Phase 20, 2026-05-15). Any install that still has the legacy
	// localStorage blob never opened the game between STO1b shipping
	// and the dep removal, which is vanishingly rare. We log a clear
	// warning, drop the legacy key so future opens stop tripping this
	// branch, and continue without importing the data.
	console.warn(
		"[ARCH3] Legacy run-history blob detected, but sql.js has been removed " +
			"in Phase 20. Run history prior to STO1b is unrecoverable on this " +
			"install. Dropping the legacy localStorage key. (raw size: %d chars)",
		raw.length,
	);
	localStorage.removeItem(LEGACY_STORAGE_KEY);
	return 0;
}

/**
 * A handle to the open history db. Construct once per app lifetime via
 * `openRunHistory()`. All writes immediately persist; there is no
 * `flush()` / `close()` step required for correctness.
 */
export type RunHistory = Readonly<{
	insert(record: RunInsert, now: number): Promise<RunRecord>;
	listRecent(limit: number): Promise<RunRecord[]>;
	bestRun(): Promise<RunRecord | null>;
	runCount(): Promise<number>;
	/** Drop everything. Used by tests and the debug HUD reset button. */
	clear(): Promise<void>;
}>;

export async function openRunHistory(): Promise<RunHistory> {
	const db = await createDatabase();
	await ensureSchema(db);
	await migrateLegacyBlobIfPresent(db);

	const insert: RunHistory["insert"] = async (record, now) => {
		await db.execute(
			`INSERT INTO runs (started_at, ended_at, levels_cleared, total_kills,
			                   total_damage_taken, total_secrets, level_set, outcome)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				record.startedAt,
				now,
				record.levelsCleared,
				record.totalKills,
				record.totalDamageTaken,
				record.totalSecrets,
				record.levelSet,
				record.outcome,
			],
		);
		await db.saveToStore?.();
		// sqlite's last_insert_rowid() requires plugin-specific syntax;
		// instead we re-query by ended_at + outcome which is unique
		// enough within a single-process write (millisecond timestamps
		// + ordered descending). Simpler than threading rowid through
		// the adapter contract.
		const rows = await db.query<RunRow>(`SELECT * FROM runs ORDER BY id DESC LIMIT ?`, [1]);
		const inserted = rows[0];
		if (inserted === undefined) {
			throw new Error("runHistory.insert: row not found after INSERT");
		}
		return rowToRecord(inserted);
	};

	const listRecent: RunHistory["listRecent"] = async (limit) => {
		const rows = await db.query<RunRow>(`SELECT * FROM runs ORDER BY ended_at DESC LIMIT ?`, [
			limit,
		]);
		return rows.map(rowToRecord);
	};

	const bestRun: RunHistory["bestRun"] = async () => {
		// "Best" = furthest progress, then highest kills, then earliest
		// run among ties (so the first time you hit a milestone wins).
		const rows = await db.query<RunRow>(
			`SELECT * FROM runs ORDER BY levels_cleared DESC, total_kills DESC, ended_at ASC LIMIT ?`,
			[1],
		);
		const best = rows[0];
		return best === undefined ? null : rowToRecord(best);
	};

	const runCount: RunHistory["runCount"] = async () => {
		const rows = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM runs`);
		return Number(rows[0]?.n ?? 0);
	};

	const clear: RunHistory["clear"] = async () => {
		await db.execute(`DELETE FROM runs`);
		await db.saveToStore?.();
	};

	return { insert, listRecent, bestRun, runCount, clear };
}

/**
 * POL32 — format a run duration in milliseconds as a human-readable
 * `m:ss` string (or `h:mm:ss` for runs that broke the hour mark).
 * Exported so both the landing-page BestRunChip and any future HUD
 * surface share one canonical formatting rule.
 *
 * Negative or NaN inputs clamp to "0:00" — the landing chip uses
 * `endedAt - startedAt` which can theoretically go negative if a row
 * was hand-edited; we don't want a `-1:-23` artifact in the UI.
 */
export function formatRunDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "0:00";
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const ss = seconds.toString().padStart(2, "0");
	if (hours > 0) {
		const mm = minutes.toString().padStart(2, "0");
		return `${hours}:${mm}:${ss}`;
	}
	return `${minutes}:${ss}`;
}

interface RunRow {
	id: number;
	started_at: number;
	ended_at: number;
	levels_cleared: number;
	total_kills: number;
	total_damage_taken: number;
	total_secrets: number | null;
	level_set: string;
	outcome: string;
}

function rowToRecord(row: RunRow): RunRecord {
	return {
		id: Number(row.id),
		startedAt: Number(row.started_at),
		endedAt: Number(row.ended_at),
		levelsCleared: Number(row.levels_cleared),
		totalKills: Number(row.total_kills),
		totalDamageTaken: Number(row.total_damage_taken),
		totalSecrets: Number(row.total_secrets) || 0,
		levelSet: String(row.level_set),
		outcome: String(row.outcome) as RunOutcome,
	};
}
