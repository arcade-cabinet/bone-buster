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
};

export default config;
