import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative base so the build works from any sub-path (e.g. GitHub Pages).
  base: "./",
  build: {
    // The game bundle is mostly Three.js (~260 kB gzipped), which is expected for a 3D game.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        menu: resolve(import.meta.dirname, "index.html"),
        game: resolve(import.meta.dirname, "game.html"),
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
