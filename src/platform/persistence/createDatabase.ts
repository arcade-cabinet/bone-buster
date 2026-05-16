/**
 * STO1b — platform-aware database factory.
 *
 * Returns an open `DatabaseAdapter`. Selection logic:
 *   - native (iOS/Android)        → CapacitorDatabase
 *   - web with jeep-sqlite ready  → CapacitorDatabase
 *   - web without jeep-sqlite     → InMemoryDatabase (ephemeral fallback)
 *   - non-window context (tests)  → InMemoryDatabase
 *
 * The web fallback exists so the game still loads when jeep-sqlite
 * fails to wire (third-party iframe with restricted storage, etc) —
 * the user loses run-history persistence for that session only, not
 * the ability to play.
 */

import { Capacitor } from "@capacitor/core";
import { CapacitorDatabase } from "@platform/persistence/capacitorDatabase";
import type { DatabaseAdapter } from "@platform/persistence/database";
import { InMemoryDatabase } from "@platform/persistence/database";
import { isJeepSqliteReady } from "@platform/persistence/initJeepSqlite";

export async function createDatabase(dbName = "objexoom"): Promise<DatabaseAdapter> {
	const canUseCapacitorSqlite =
		typeof window !== "undefined" && (Capacitor.getPlatform() !== "web" || isJeepSqliteReady());
	if (!canUseCapacitorSqlite) {
		return new InMemoryDatabase();
	}
	const db = new CapacitorDatabase(dbName);
	try {
		await db.open();
		return db;
	} catch (err) {
		console.warn("[STO1b] CapacitorDatabase open failed; falling back to in-memory:", err);
		return new InMemoryDatabase();
	}
}
