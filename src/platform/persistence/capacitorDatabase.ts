/**
 * STO1b — production SQLite adapter using @capacitor-community/sqlite.
 *
 * Platform routing:
 *   - native (iOS/Android) → Capacitor SQLite plugin → native SQLite
 *   - web                  → Capacitor SQLite plugin → jeep-sqlite
 *                            (WASM-backed, IndexedDB-persisted)
 *
 * Both share the same JS surface (`SQLiteConnection` /
 * `SQLiteDBConnection`); the difference is hidden by Capacitor's
 * platform dispatch. The only web-specific call is `initWebStore()`
 * which loads the IndexedDB-backed blob on first open — that's done
 * once at app boot from `app/main.tsx` via `initJeepSqlite.ts`, not
 * here.
 */

import { Capacitor } from "@capacitor/core";
import {
	CapacitorSQLite,
	SQLiteConnection,
	type SQLiteDBConnection,
} from "@capacitor-community/sqlite";
import type { DatabaseAdapter } from "@platform/persistence/database";

export class CapacitorDatabase implements DatabaseAdapter {
	#db: SQLiteDBConnection | null = null;
	#sqlite: SQLiteConnection;
	readonly #dbName: string;
	readonly #isWeb: boolean;

	constructor(dbName = "objexoom") {
		this.#dbName = dbName;
		this.#sqlite = new SQLiteConnection(CapacitorSQLite);
		this.#isWeb = Capacitor.getPlatform() === "web";
	}

	async open(): Promise<void> {
		// Capacitor SQLite distinguishes "connection exists" from "open"
		// — we retrieve an existing connection when possible to avoid
		// the plugin's "connection already exists" error, otherwise
		// create a fresh one. Both paths leave the db open at the end.
		const consistency = await this.#sqlite.checkConnectionsConsistency();
		const isConn = (await this.#sqlite.isConnection(this.#dbName, false)).result;
		if (consistency.result && isConn) {
			this.#db = await this.#sqlite.retrieveConnection(this.#dbName, false);
		} else {
			this.#db = await this.#sqlite.createConnection(
				this.#dbName,
				false, // not encrypted
				"no-encryption",
				1, // version — we use a single non-upgrading schema for now
				false, // not readonly
			);
		}
		await this.#db.open();
	}

	async execute(sql: string, params: unknown[] = []): Promise<void> {
		if (!this.#db) throw new Error("CapacitorDatabase: connection not open — call open() first");
		await this.#db.run(sql, params as (string | number | boolean | null)[]);
	}

	async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
		if (!this.#db) throw new Error("CapacitorDatabase: connection not open — call open() first");
		const result = await this.#db.query(sql, params as (string | number | boolean | null)[]);
		return (result.values ?? []) as T[];
	}

	async saveToStore(): Promise<void> {
		if (!this.#isWeb) return; // native writes are already durable
		if (!this.#db) return;
		// Capacitor's `saveToStore` flushes the IndexedDB-backed blob.
		// Cheap to call after every write batch.
		await this.#sqlite.saveToStore(this.#dbName);
	}

	async close(): Promise<void> {
		if (this.#db) {
			await this.#db.close();
			this.#db = null;
		}
		// Don't actively closeConnection — keeping the connection in the
		// Capacitor plugin's dict avoids the "already exists" error on
		// hot-reload during dev. The connection is per-database; one
		// dangling reference is fine.
	}
}
