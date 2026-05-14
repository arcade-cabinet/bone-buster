import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
	// `mode === "github-pages"` produces a build at /objexoom/ for the
	// objexiv-org gh-pages deploy; the default dev/build serves at /.
	base: mode === "github-pages" ? "/objexoom/" : "/",
	cacheDir: ".vite",
	build: {
		target: "es2022",
		sourcemap: true,
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@app": path.resolve(__dirname, "./app"),
		},
	},
	server: {
		host: true,
		port: 5173,
	},
	preview: {
		host: true,
		port: 8080,
	},
}));
