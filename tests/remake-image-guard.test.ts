import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectHashIndex, guardPaths } from "../scripts/guard-original-images.ts";

const root = resolve(fileURLToPath(import.meta.url), "../..");

describe("remake original-image guard", () => {
  it("has fingerprints for the extracted originals", () => {
    const { byHash, originalNames } = collectHashIndex();
    expect(byHash.size).toBeGreaterThan(100);
    expect(originalNames.has("m_main.png")).toBe(true);
    expect(originalNames.has("mus_hand.png")).toBe(true);
  });

  it("allows the existing workbench extract and nothing else in the git tree", () => {
    const findings = guardPaths(root);
    expect(findings).toEqual([]);
  });

  it("scans dist/ when a build is present", () => {
    if (!existsSync(resolve(root, "dist"))) return;
    const findings = guardPaths(root, ["dist"]);
    expect(findings).toEqual([]);
  });
});
