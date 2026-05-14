/**
 * E9 — persistent run history backed by sql.js, serialized into a single
 * base64 blob under `localStorage["objexoom.runHistory"]`. Rows are ~50
 * bytes each so the 5MB localStorage budget covers ~100k runs.
 *
 * WASM loaded from `<base>/assets/wasm/sql-wasm.wasm`, copied at
 * postinstall + prebuild by `scripts/prepare-web-wasm.mjs`.
 */

import initSqlJs, { type Database } from "sql.js";
import { A } from "./assetUrl";
import type { LevelChoice } from "./settings";

const STORAGE_KEY = "objexoom.runHistory";

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
	// "procedural" or 1-5 — stored as string for forward compat.
	levelSet: string;
	outcome: RunOutcome;
}>;

/** Shape passed in when recording — id + endedAt are filled by the store. */
export type RunInsert = Readonly<{
	startedAt: number;
	levelsCleared: number;
	totalKills: number;
	totalDamageTaken: number;
	level: LevelChoice;
	outcome: RunOutcome;
}>;

function decodeStoredBlob(): Uint8Array | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		const binary = atob(raw);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}

function encodeAndStore(db: Database) {
	if (typeof localStorage === "undefined") return;
	const bytes = db.export();
	let binary = "";
	for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
	try {
		localStorage.setItem(STORAGE_KEY, btoa(binary));
	} catch {
		// Quota or private-mode failure — drop silently. The run-history
		// chip is a nice-to-have; not worth aborting gameplay over.
	}
}

function ensureSchema(db: Database) {
	db.run(`
		CREATE TABLE IF NOT EXISTS runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			started_at INTEGER NOT NULL,
			ended_at INTEGER NOT NULL,
			levels_cleared INTEGER NOT NULL,
			total_kills INTEGER NOT NULL,
			total_damage_taken INTEGER NOT NULL,
			level_set TEXT NOT NULL,
			outcome TEXT NOT NULL
		);
	`);
	db.run(`CREATE INDEX IF NOT EXISTS runs_ended_at_desc ON runs (ended_at DESC);`);
}

/**
 * A handle to the open history db. Construct once per app lifetime via
 * `openRunHistory()`. All writes immediately re-persist to localStorage,
 * so there is no `flush()` / `close()` step required for correctness.
 */
export type RunHistory = Readonly<{
	insert(record: RunInsert, now: number): RunRecord;
	listRecent(limit: number): RunRecord[];
	bestRun(): RunRecord | null;
	runCount(): number;
	/** Drop everything. Used by tests and the debug HUD reset button. */
	clear(): void;
}>;

export async function openRunHistory(): Promise<RunHistory> {
	const SQL = await initSqlJs({
		// Resolve via the asset-url helper so GitHub-Pages base prefix
		// + Capacitor file:// origins both work.
		locateFile: () => A("/assets/wasm/sql-wasm.wasm"),
	});
	const existing = decodeStoredBlob();
	const db = existing ? new SQL.Database(existing) : new SQL.Database();
	ensureSchema(db);

	const insert: RunHistory["insert"] = (record, now) => {
		db.run(
			`INSERT INTO runs (started_at, ended_at, levels_cleared, total_kills,
			                   total_damage_taken, level_set, outcome)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				record.startedAt,
				now,
				record.levelsCleared,
				record.totalKills,
				record.totalDamageTaken,
				String(record.level),
				record.outcome,
			],
		);
		const stmt = db.prepare(`SELECT * FROM runs WHERE id = last_insert_rowid()`);
		stmt.step();
		const row = stmt.getAsObject() as Record<string, unknown>;
		stmt.free();
		encodeAndStore(db);
		return rowToRecord(row);
	};

	const listRecent: RunHistory["listRecent"] = (limit) => {
		const stmt = db.prepare(`SELECT * FROM runs ORDER BY ended_at DESC LIMIT ?`);
		stmt.bind([limit]);
		const out: RunRecord[] = [];
		while (stmt.step()) out.push(rowToRecord(stmt.getAsObject() as Record<string, unknown>));
		stmt.free();
		return out;
	};

	const bestRun: RunHistory["bestRun"] = () => {
		// "Best" = furthest progress, then highest kills, then earliest run
		// among ties (so the first time you hit a milestone wins).
		const stmt = db.prepare(`
			SELECT * FROM runs
			ORDER BY levels_cleared DESC, total_kills DESC, ended_at ASC
			LIMIT 1
		`);
		if (!stmt.step()) {
			stmt.free();
			return null;
		}
		const row = stmt.getAsObject() as Record<string, unknown>;
		stmt.free();
		return rowToRecord(row);
	};

	const runCount: RunHistory["runCount"] = () => {
		const stmt = db.prepare(`SELECT COUNT(*) AS n FROM runs`);
		stmt.step();
		const row = stmt.getAsObject() as { n: number };
		stmt.free();
		return Number(row.n) || 0;
	};

	const clear: RunHistory["clear"] = () => {
		db.run(`DELETE FROM runs`);
		encodeAndStore(db);
	};

	return { insert, listRecent, bestRun, runCount, clear };
}

function rowToRecord(row: Record<string, unknown>): RunRecord {
	return {
		id: Number(row.id),
		startedAt: Number(row.started_at),
		endedAt: Number(row.ended_at),
		levelsCleared: Number(row.levels_cleared),
		totalKills: Number(row.total_kills),
		totalDamageTaken: Number(row.total_damage_taken),
		levelSet: String(row.level_set),
		outcome: String(row.outcome) as RunOutcome,
	};
}
