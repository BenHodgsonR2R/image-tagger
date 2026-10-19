import { fileURLToPath } from "node:url";
import preactPreset from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative, so the build works under GitHub Pages' /image-tagger/ path.
  base: "./",
  plugins: [preactPreset(), tailwindcss()],
  resolve: {
    alias: {
      "@bhodgson/image-tagger": fileURLToPath(
        new URL("../src/index.ts", import.meta.url),
      ),
    },
  },
});
