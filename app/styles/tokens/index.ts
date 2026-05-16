/**
 * OBJEXOOM design tokens — public barrel.
 *
 * Importing from `@/design-tokens` gives you everything; importing
 * from a specific sub-module (`@/design-tokens/colors`) keeps the
 * import surface narrow.
 *
 * Token philosophy is documented in `docs/DESIGN.md`. The short
 * version:
 *  - OBJEXOOM is a tribute to Objexiv (gradient lineage, indigo+violet
 *    accent family) standing on its own in a dark-mode + horror
 *    palette with blood + ember as new action axes.
 *  - Code should reference SEMANTIC roles (`ROLE.actionFire`), not raw
 *    scale values (`SCALE.blood[500]`) — that way swapping the scale
 *    propagates without grep.
 */

export * from "@styles/tokens/colors";
export * from "@styles/tokens/motion";
export * from "@styles/tokens/spacing";
export * from "@styles/tokens/typography";
