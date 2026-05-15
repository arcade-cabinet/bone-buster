/**
 * STO1b — InMemoryDatabase adapter contract.
 *
 * Pins the SQL-shape coverage so future contributors can't add an
 * unsupported statement to runHistory.ts without the test failing
 * first. Validates the auto-increment id, ORDER BY (single + multi-
 * column), LIMIT, COUNT(*), and DELETE behaviors that runHistory
 * relies on.
 */

import { describe, expect, it } from "vitest";
import { InMemoryDatabase } from "@/persistence/database";

const CREATE = `
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
`;

const INSERT = `
	INSERT INTO runs (started_at, ended_at, levels_cleared, total_kills,
	                   total_damage_taken, total_secrets, level_set, outcome)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

describe("STO1b — InMemoryDatabase", () => {
	it("captures the table name from CREATE TABLE", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		expect(db.tableName).toBe("runs");
	});

	it("auto-increments id when not provided", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		await db.execute(INSERT, [100, 200, 1, 5, 0, 0, "1", "won"]);
		await db.execute(INSERT, [300, 400, 2, 10, 0, 0, "2", "won"]);
		expect(db.rows.map((r) => r.id)).toEqual([1, 2]);
	});

	it("CREATE INDEX and ALTER TABLE are no-ops (forward-compat ddl)", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		await db.execute(`CREATE INDEX IF NOT EXISTS runs_ended_at_desc ON runs (ended_at DESC);`);
		await db.execute(`ALTER TABLE runs ADD COLUMN unused TEXT;`);
		expect(db.rows.length).toBe(0);
	});

	it("SELECT COUNT(*) AS n returns row count", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		await db.execute(INSERT, [100, 200, 1, 5, 0, 0, "1", "won"]);
		await db.execute(INSERT, [300, 400, 2, 10, 0, 0, "2", "won"]);
		const result = await db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM runs`);
		expect(result[0]?.n).toBe(2);
	});

	it("ORDER BY single column DESC sorts newest-first", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		await db.execute(INSERT, [100, 200, 1, 5, 0, 0, "1", "won"]);
		await db.execute(INSERT, [300, 400, 2, 10, 0, 0, "2", "won"]);
		const rows = await db.query<{ ended_at: number }>(
			`SELECT * FROM runs ORDER BY ended_at DESC LIMIT ?`,
			[10],
		);
		expect(rows.map((r) => r.ended_at)).toEqual([400, 200]);
	});

	it("ORDER BY multi-column composes (levels DESC, kills DESC, ended_at ASC)", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		// Two rows tied on levels_cleared=5, different totals.
		await db.execute(INSERT, [100, 200, 5, 30, 0, 0, "1", "won"]);
		await db.execute(INSERT, [300, 400, 5, 80, 0, 0, "1", "won"]);
		await db.execute(INSERT, [500, 600, 3, 99, 0, 0, "1", "won"]);
		const rows = await db.query<{ total_kills: number; levels_cleared: number }>(
			`SELECT * FROM runs ORDER BY levels_cleared DESC, total_kills DESC, ended_at ASC LIMIT ?`,
			[1],
		);
		expect(rows[0]?.levels_cleared).toBe(5);
		expect(rows[0]?.total_kills).toBe(80);
	});

	it("WHERE id = ? returns the matching row only", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		await db.execute(INSERT, [100, 200, 1, 5, 0, 0, "1", "won"]);
		await db.execute(INSERT, [300, 400, 2, 10, 0, 0, "2", "won"]);
		const rows = await db.query<{ id: number; total_kills: number }>(
			`SELECT * FROM runs WHERE id = ?`,
			[2],
		);
		expect(rows.length).toBe(1);
		expect(rows[0]?.total_kills).toBe(10);
	});

	it("DELETE FROM clears the table and resets the id counter", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		await db.execute(INSERT, [100, 200, 1, 5, 0, 0, "1", "won"]);
		await db.execute(`DELETE FROM runs`);
		expect(db.rows.length).toBe(0);
		await db.execute(INSERT, [300, 400, 2, 10, 0, 0, "2", "won"]);
		expect(db.rows[0]?.id).toBe(1);
	});

	it("LIMIT ? bounds the result count", async () => {
		const db = new InMemoryDatabase();
		await db.execute(CREATE);
		for (let i = 0; i < 5; i += 1) {
			await db.execute(INSERT, [i * 100, i * 100 + 50, i, i * 2, 0, 0, "1", "won"]);
		}
		const rows = await db.query<{ id: number }>(
			`SELECT * FROM runs ORDER BY ended_at DESC LIMIT ?`,
			[3],
		);
		expect(rows.length).toBe(3);
	});
});
