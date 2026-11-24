import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/penpad-clinergy-workbench/",
  test: { environment: "node" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("ehrtslib-0.17.0.min.js")) return "ehrtslib";
        },
      },
    },
  },
});
