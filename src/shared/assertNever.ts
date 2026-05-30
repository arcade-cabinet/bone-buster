/**
 * PREP-BP2 — exhaustiveness guard for discriminated-union switches.
 *
 * Call in the `default` arm of a `switch` over a tagged union. If every variant
 * is handled, the `never`-typed parameter type-checks; the moment a new variant
 * is added to the union (e.g. a STRUCT4 GameAction / GameEffect), the unhandled
 * case makes `x` non-`never` and this becomes a COMPILE error — turning a silent
 * fall-through (the switch returning `undefined`) into a build failure at the
 * exact site that needs updating.
 *
 * It also throws at runtime as a defensive backstop for an impossible value that
 * slips past the type system (e.g. malformed data deserialized at a boundary).
 */
export function assertNever(x: never, context = "value"): never {
	throw new Error(`Unhandled ${context}: ${JSON.stringify(x)}`);
}
