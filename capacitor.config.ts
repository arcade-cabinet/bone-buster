import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.objexiv.objexoom",
	appName: "OBJEXOOM",
	webDir: "dist",
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
