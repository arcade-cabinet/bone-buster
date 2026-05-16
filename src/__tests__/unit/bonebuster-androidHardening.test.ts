/**
 * S1 — Android release-build hardening pin.
 *
 * Source-text checks against:
 *   - android/app/src/main/AndroidManifest.xml
 *   - android/app/build.gradle
 *   - android/app/src/main/res/xml/data_extraction_rules.xml
 *   - android/app/proguard-rules.pro
 *
 * These are configuration files Capacitor / Android Studio
 * regenerate selectively. Without source-pin tests, a
 * `pnpm cap:sync` or accidental Android Studio "fix-it" could
 * silently revert `allowBackup="false"` back to "true" or drop
 * the proguard keep-rules — at which point the release APK
 * would ship without the hardening we just added.
 *
 * Source: SECURITY audit #2.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const MANIFEST = readFileSync(
	resolve(REPO_ROOT, "android/app/src/main/AndroidManifest.xml"),
	"utf8",
);
const BUILD_GRADLE = readFileSync(resolve(REPO_ROOT, "android/app/build.gradle"), "utf8");
const DATA_EXTRACTION = readFileSync(
	resolve(REPO_ROOT, "android/app/src/main/res/xml/data_extraction_rules.xml"),
	"utf8",
);
const PROGUARD = readFileSync(resolve(REPO_ROOT, "android/app/proguard-rules.pro"), "utf8");

describe("S1 — Android release-build hardening", () => {
	describe("AndroidManifest.xml", () => {
		it('declares android:allowBackup="false" (no auto-backup)', () => {
			expect(MANIFEST).toMatch(/android:allowBackup="false"/);
			expect(MANIFEST).not.toMatch(/android:allowBackup="true"/);
		});

		it('declares android:fullBackupContent="false"', () => {
			expect(MANIFEST).toMatch(/android:fullBackupContent="false"/);
		});

		it("references @xml/data_extraction_rules (Android 12+ schema)", () => {
			expect(MANIFEST).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/);
		});

		it("retains networkSecurityConfig + cleartext-traffic gating (S3)", () => {
			// S3 should still be in place — S1 must not regress it.
			expect(MANIFEST).toMatch(/android:networkSecurityConfig="@xml\/network_security_config"/);
		});
	});

	describe("app/build.gradle", () => {
		// Extract the release {} block so assertions don't accidentally
		// match a debug or other buildType block where minifyEnabled
		// might be intentionally false. (Patched per
		// CodeRabbit PR #59 review.)
		const releaseBlock = BUILD_GRADLE.match(/release\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";

		it("release buildType has minifyEnabled true", () => {
			expect(releaseBlock).not.toBe("");
			expect(releaseBlock).toMatch(/minifyEnabled\s+true/);
		});

		it("release buildType has shrinkResources true", () => {
			expect(releaseBlock).toMatch(/shrinkResources\s+true/);
		});

		it("release buildType references proguard-rules.pro", () => {
			expect(releaseBlock).toMatch(/proguard-rules\.pro/);
		});
	});

	describe("data_extraction_rules.xml", () => {
		// Extract each backup section so domain assertions are
		// scoped — a cloud-backup section that lost its excludes
		// can't pass on the strength of device-transfer's. (Patched
		// per CodeRabbit PR #59 review.)
		const cloudBackup = DATA_EXTRACTION.match(/<cloud-backup>[\s\S]*?<\/cloud-backup>/)?.[0] ?? "";
		const deviceTransfer =
			DATA_EXTRACTION.match(/<device-transfer>[\s\S]*?<\/device-transfer>/)?.[0] ?? "";

		it("excludes ALL cloud-backup domains (no Google Drive sync)", () => {
			expect(cloudBackup).not.toBe("");
			for (const domain of ["root", "database", "sharedpref", "external", "file"]) {
				const re = new RegExp(`<exclude\\s+domain="${domain}"`);
				expect(cloudBackup, `cloud-backup must exclude domain="${domain}"`).toMatch(re);
			}
		});

		it("excludes ALL device-transfer domains (no D2D copy)", () => {
			expect(deviceTransfer).not.toBe("");
			for (const domain of ["root", "database", "sharedpref", "external", "file"]) {
				const re = new RegExp(`<exclude\\s+domain="${domain}"`);
				expect(deviceTransfer, `device-transfer must exclude domain="${domain}"`).toMatch(re);
			}
		});
	});

	describe("proguard-rules.pro", () => {
		it("keeps Capacitor core bridge (com.getcapacitor.**)", () => {
			expect(PROGUARD).toMatch(/-keep\s+class\s+com\.getcapacitor\.\*\*/);
		});

		it("keeps @CapacitorPlugin annotated classes + @PluginMethod members", () => {
			expect(PROGUARD).toMatch(/CapacitorPlugin/);
			expect(PROGUARD).toMatch(/PluginMethod/);
		});

		it("keeps the sqlite plugin (E9 / STO1b run-history)", () => {
			expect(PROGUARD).toMatch(
				/-keep\s+class\s+com\.getcapacitor\.community\.database\.sqlite\.\*\*/,
			);
		});

		it("keeps the Cordova bridge fallback classes", () => {
			expect(PROGUARD).toMatch(/-keep\s+class\s+org\.apache\.cordova\.\*\*/);
		});
	});
});
