import { writeFileSync } from "node:fs";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { ferroRegressionCases } from "../tests/ferro-cases-data.ts";

for (const item of ferroRegressionCases) {
  const built = buildThumbEncounter(item.state, item.narrative);
  const file = `tests/fixtures/ferro/${item.id}.json`;
  writeFileSync(file, `${JSON.stringify(built.canonical, null, 2)}\n`);
  console.log(`wrote ${file}`);
}