/**
 * STO1b — DatabaseAdapter abstraction over @capacitor-community/sqlite.
 *
 * Surface design mirrors `~/src/arcade-cabinet/bok/src/persistence/`
 * (the user-cited reference): a tiny interface (`execute` / `query`)
 * with two implementations:
 *   - `CapacitorDatabase` (production) — wraps the Capacitor plugin;
 *     on native uses iOS/Android SQLite, on web uses jeep-sqlite
 *     (WASM, IndexedDB-backed) so the same SQL runs in both.
 *   - `InMemoryDatabase` (test) — Map-backed mock with minimal SQL
 *     parsing for runs-table CRUD. NOT a full SQLite implementation;
 *     only the SQL shapes the app actually uses are supported.
 *
 * Why this interface, not "import sqlite directly":
 *   - Tests need a synchronous-ish path that doesn't depend on
 *     loading WASM (vitest runs in Node where jeep-sqlite isn't
 *     wired). InMemoryDatabase satisfies that.
 *   - The runtime selection (`createDatabase`) sits behind one
 *     factory call so swapping the backend (e.g. for an encrypted
 *     impl, or for a different test mock) is one-line.
 *   - App code reads only `DatabaseAdapter`, never the concrete
 *     plugin types. Capacitor's API surface can churn behind this
 *     boundary without app-code edits.
 */

/** Public contract every backend implements. */
export interface DatabaseAdapter {
	/** Execute a write statement (CREATE / INSERT / UPDATE / DELETE). */
	execute(sql: string, params?: unknown[]): Promise<void>;
	/** Run a SELECT. Result rows are returned as plain objects keyed by column name. */
	query<T>(sql: string, params?: unknown[]): Promise<T[]>;
	/**
	 * Persist any pending changes to the durable web store. No-op on
	 * native (writes are already durable); on web, calls Capacitor's
	 * `saveToStore` so the IndexedDB-backed jeep-sqlite blob is
	 * flushed. Safe to call after every batch of writes.
	 */
	saveToStore?(): Promise<void>;
	/** Close the underlying connection. Idempotent. */
	close(): Promise<void>;
}

/**
 * In-memory test adapter. Supports only the SQL shapes the run-history
 * subsystem uses; not a general-purpose SQLite shim. Reads from a
 * single `rows: T[]` array under one fixed table name so tests can
 * inspect / seed state directly via the `rows` accessor.
 *
 * Supported statements:
 *   CREATE TABLE IF NOT EXISTS <name> (...)   — recorded, no-op
 *   CREATE INDEX IF NOT EXISTS ...            — no-op
 *   ALTER TABLE ... ADD COLUMN ...            — no-op (forward-compat only)
 *   INSERT INTO <name> (cols) VALUES (?, ?...)
 *   SELECT * FROM <name> [WHERE id = ?]
 *      [ORDER BY <col> {ASC|DESC} [, <col> {ASC|DESC}]] [LIMIT ?]
 *   SELECT COUNT(*) AS n FROM <name>
 *   DELETE FROM <name>
 *
 * Auto-increment `id`: when an INSERT doesn't include `id` in the
 * column list, the next sequential integer (starting at 1) is
 * assigned. Matches sqlite's `INTEGER PRIMARY KEY AUTOINCREMENT`
 * behavior closely enough for the run-history use case.
 */
export class InMemoryDatabase implements DatabaseAdapter {
	#rows: Record<string, unknown>[] = [];
	#nextId = 1;
	#tableName = "";

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		const stmt = sql.trim();

		const create = stmt.match(/^CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/i);
		if (create) {
			this.#tableName = create[1];
			return;
		}
		// Other DDL — no-op for the mock.
		if (/^CREATE INDEX/i.test(stmt)) return;
		if (/^ALTER TABLE/i.test(stmt)) return;

		const insert = stmt.match(/^INSERT INTO \w+\s*\(([^)]+)\)\s+VALUES\s*\(([^)]+)\)/i);
		if (insert) {
			const cols = insert[1].split(",").map((c) => c.trim());
			const valueTokens = insert[2].split(",").map((v) => v.trim());
			const row: Record<string, unknown> = {};
			let paramIdx = 0;
			for (let i = 0; i < cols.length; i += 1) {
				const tok = valueTokens[i];
				if (tok === "?") {
					row[cols[i]] = params[paramIdx];
					paramIdx += 1;
				} else if (/^-?\d+(?:\.\d+)?$/.test(tok)) {
					row[cols[i]] = Number(tok);
				} else {
					row[cols[i]] = tok.replace(/^['"]|['"]$/g, "");
				}
			}
			if (!("id" in row)) {
				row.id = this.#nextId;
				this.#nextId += 1;
			} else if (typeof row.id === "number" && row.id >= this.#nextId) {
				this.#nextId = row.id + 1;
			}
			this.#rows.push(row);
			return;
		}

		if (/^DELETE FROM/i.test(stmt)) {
			this.#rows = [];
			this.#nextId = 1;
			return;
		}

		throw new Error(`InMemoryDatabase: unsupported SQL: ${stmt}`);
	}

	async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
		const stmt = sql.trim();

		if (/^SELECT\s+COUNT\(\*\)\s+AS\s+n\s+FROM/i.test(stmt)) {
			return [{ n: this.#rows.length } as unknown as T];
		}

		// id = ? lookup (used by last_insert_rowid()-style fetches; we
		// translate the runHistory call to a parametric lookup on id).
		const byId = stmt.match(/WHERE\s+id\s*=\s*\?/i);
		if (byId && params.length === 1) {
			const target = params[0];
			const hit = this.#rows.find((r) => r.id === target);
			return hit ? [hit as unknown as T] : [];
		}

		// ORDER BY <col> {ASC|DESC} [, <col2> {ASC|DESC}, ...]
		// LIMIT ?
		// The capture stops at LIMIT or end-of-string. Case-insensitive
		// boundary on LIMIT so columns containing 'L' (e.g.
		// `levels_cleared`) aren't accidentally truncated.
		let rows = [...this.#rows];
		const orderMatch = stmt.match(/ORDER BY\s+(.+?)(?:\s+LIMIT\b|\s*$)/i);
		if (orderMatch) {
			const orderClauses = orderMatch[1].split(",").map((c) => c.trim());
			rows.sort((a, b) => {
				for (const clause of orderClauses) {
					const m = clause.match(/(\w+)\s*(ASC|DESC)?/i);
					if (!m) continue;
					const col = m[1];
					const desc = (m[2] ?? "ASC").toUpperCase() === "DESC";
					const va = a[col];
					const vb = b[col];
					let cmp = 0;
					if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
					else cmp = String(va ?? "").localeCompare(String(vb ?? ""));
					if (cmp !== 0) return desc ? -cmp : cmp;
				}
				return 0;
			});
		}
		const limitMatch = stmt.match(/LIMIT\s+\?/i);
		if (limitMatch && params.length > 0) {
			const limit = params[params.length - 1];
			if (typeof limit === "number") rows = rows.slice(0, limit);
		}

		return rows as unknown as T[];
	}

	async close(): Promise<void> {
		this.#rows = [];
		this.#nextId = 1;
	}

	/** Test-only accessor — read the underlying rows for assertions. */
	get rows(): readonly Record<string, unknown>[] {
		return this.#rows;
	}

	/** Test-only accessor — name captured from the CREATE TABLE call. */
	get tableName(): string {
		return this.#tableName;
	}
}
