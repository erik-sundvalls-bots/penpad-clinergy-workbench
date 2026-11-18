/**
 * Build, restart preview, log commit SHA, run a capture script.
 * Usage: node scripts/capture-with-build.mjs scripts/capture-sidebar-character.mjs
 */
import { spawn, execSync } from "node:child_process";
import { createConnection } from "node:net";

const captureScript = process.argv[2];
if (!captureScript) {
  console.error("usage: node scripts/capture-with-build.mjs <capture.mjs>");
  process.exit(1);
}

const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
console.log(`capture-log commit=${sha}`);

execSync("npm run build", { stdio: "inherit" });

const port = 4173;
try {
  execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: "ignore", shell: true });
} catch {
  /* ignore */
}

const preview = spawn("npm", ["run", "preview"], { stdio: "pipe", detached: true });
preview.unref();

async function waitPort() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const open = await new Promise((resolve) => {
      const s = createConnection({ port, host: "127.0.0.1" });
      s.once("connect", () => {
        s.end();
        resolve(true);
      });
      s.once("error", () => resolve(false));
    });
    if (open) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("preview did not start");
}

await waitPort();
execSync(`npx vite-node ${captureScript}`, { stdio: "inherit", env: { ...process.env, CAPTURE_COMMIT: sha } });
try {
  process.kill(-preview.pid, "SIGTERM");
} catch {
  preview.kill("SIGTERM");
}