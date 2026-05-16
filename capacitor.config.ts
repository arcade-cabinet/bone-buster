import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.bonebuster.app",
	appName: "Bone Buster",
	// Post-Vike: the build splits into dist/client/ (browser bundle +
	// prerendered index.html) and dist/server/ (SSR/prerender entry).
	// Capacitor wraps the client bundle, so point webDir at dist/client.
	webDir: "dist/client",
	server: {
		androidScheme: "https",
	},
	android: {
		backgroundColor: "#07060f",
	},
	ios: {
		backgroundColor: "#07060f",
	},
	plugins: {
		// STO1b — @capacitor-community/sqlite plugin config. iOS database
		// location: standard Library/CapacitorDatabase directory inside
		// the app sandbox. Encryption disabled — run history is not
		// sensitive data and encryption would add a passphrase-management
		// surface we don't need for a single-player game.
		CapacitorSQLite: {
			iosDatabaseLocation: "Library/CapacitorDatabase",
			iosIsEncryption: false,
			androidIsEncryption: false,
		},
	},
};

export default config;
