import { existsSync, createReadStream, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

/** Dev-only: serve gitignored remake/local-originals. Never copied into dist. */
function serveLocalOriginals(): Plugin {
  const dir = resolve(__dirname, "remake/local-originals");
  const prefix = "/penpad-clinergy-workbench/remake/local-originals";
  return {
    name: "serve-remake-local-originals",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith(`${prefix}/`) && url !== prefix) return next();
        const rel = decodeURIComponent(url.slice(prefix.length).replace(/^\/+/, ""));
        if (!rel || rel.split("/").includes("..")) {
          res.statusCode = 400;
          res.end("bad path");
          return;
        }
        const file = join(dir, rel);
        if (!existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end("local original not found");
          return;
        }
        if (file.endsWith(".png")) res.setHeader("Content-Type", "image/png");
        else if (file.endsWith(".svg")) res.setHeader("Content-Type", "image/svg+xml");
        else if (file.endsWith(".jpg") || file.endsWith(".jpeg")) res.setHeader("Content-Type", "image/jpeg");
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  base: "/penpad-clinergy-workbench/",
  plugins: [serveLocalOriginals()],
  test: { environment: "node", setupFiles: ["tests/setup-generated-forms.ts"] },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        remake: resolve(__dirname, "remake/index.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("ehrtslib-0.20.0.min.js")) return "ehrtslib";
        },
      },
    },
  },
});
