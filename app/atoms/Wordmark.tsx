/**
 * BoneBusterWordmark (PRD §R3).
 *
 * Inline SVG `<text>` wordmark using the Bungee family. The full
 * layered Bungee + Bungee Inline + Bungee Shade letterpress effect
 * (per docs/REBRAND.md) is deferred to a polish pass after the
 * structural R3 lands; this version renders the canonical single-
 * pass "BONE BUSTER" wordmark with a bone-palette gradient fill and
 * a blood-stroke outline.
 *
 * Animation: framer-motion staggered drop-in per letter (spring),
 * `useReducedMotion`-aware. A Tilt Prism axis-flicker fires once
 * 1.4s after mount on the trailing E/R glyphs — a single signature
 * phase-glitch on lock-in.
 *
 * Accessibility: SVG carries `role="img" aria-label="Bone Buster"`
 * so AT and Playwright queries find the wordmark by accessible name.
 */

import { BONE_PALETTE, ROLE } from "@styles/tokens/index";
import { TYPE } from "@styles/tokens/typography";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";

const TITLE = "BONE BUSTER";

type Props = Readonly<{
	width?: number;
	height?: number;
}>;

export function BoneBusterWordmark({ width = 720, height = 180 }: Props) {
	const reduceMotion = useReducedMotion();
	const [flickered, setFlickered] = useState(false);

	useEffect(() => {
		if (reduceMotion) return;
		const t = window.setTimeout(() => setFlickered(true), 1400);
		const u = window.setTimeout(() => setFlickered(false), 2000);
		return () => {
			window.clearTimeout(t);
			window.clearTimeout(u);
		};
	}, [reduceMotion]);

	const containerVariants: Variants = {
		hidden: { opacity: reduceMotion ? 0 : 1 },
		shown: {
			opacity: 1,
			transition: reduceMotion ? { duration: 0.4 } : { staggerChildren: 0.06, delayChildren: 0.1 },
		},
	};

	const letterVariants: Variants = reduceMotion
		? {
				hidden: { opacity: 0 },
				shown: { opacity: 1, transition: { duration: 0.4 } },
			}
		: {
				hidden: { y: -80, opacity: 0 },
				shown: {
					y: 0,
					opacity: 1,
					transition: { type: "spring" as const, stiffness: 320, damping: 22 },
				},
			};

	const glyphs = TITLE.split("");
	const padding = width * 0.04;
	const usable = width - padding * 2;
	const glyphAdvance = usable / glyphs.length;
	const baselineY = height * 0.72;
	const fontSize = height * 0.62;

	return (
		<motion.svg
			viewBox={`0 0 ${width} ${height}`}
			width="100%"
			style={{ maxWidth: width, display: "block", overflow: "visible" }}
			role="img"
			aria-label="Bone Buster"
			initial="hidden"
			animate="shown"
			variants={containerVariants}
		>
			<defs>
				<linearGradient id="bone-buster-fill" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor={BONE_PALETTE.brandBone1} />
					<stop offset="55%" stopColor={BONE_PALETTE.brandBone2} />
					<stop offset="100%" stopColor={BONE_PALETTE.brandBone3} />
				</linearGradient>
			</defs>

			{glyphs.map((ch, i) => {
				const x = padding + glyphAdvance * (i + 0.5);
				const isFlairTarget = flickered && (ch === "E" || ch === "R");
				const family = isFlairTarget ? TYPE.flair : TYPE.display;
				const key = `${ch === " " ? "_space_" : ch}@${i}`;
				return (
					<motion.text
						key={key}
						x={x}
						y={baselineY}
						fontFamily={family}
						fontSize={fontSize}
						fill="url(#bone-buster-fill)"
						stroke={BONE_PALETTE.brandBlood}
						strokeWidth={1.5}
						textAnchor="middle"
						style={{ paintOrder: "stroke fill" }}
						variants={letterVariants}
					>
						{ch === " " ? " " : ch}
					</motion.text>
				);
			})}

			<motion.line
				x1={padding * 1.4}
				y1={baselineY + fontSize * 0.18}
				x2={width - padding * 1.4}
				y2={baselineY + fontSize * 0.18}
				stroke={ROLE.brand.blood}
				strokeWidth={2}
				strokeLinecap="round"
				initial={reduceMotion ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
				animate={reduceMotion ? { opacity: 0.55 } : { pathLength: 1, opacity: 0.55 }}
				transition={
					reduceMotion
						? { duration: 0.4, delay: 0.4 }
						: { duration: 0.8, delay: 1.0, ease: "easeOut" }
				}
			/>
		</motion.svg>
	);
}
