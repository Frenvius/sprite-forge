import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async ({ mode }) => ({
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  clearScreen: false,
  server: {
    port: 8080,
    strictPort: true,
    host: host || "localhost",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 8081,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        find: path.resolve(__dirname, "find.html"),
        slicer: path.resolve(__dirname, "slicer.html"),
        template: path.resolve(__dirname, "template.html"),
      },
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
}));

