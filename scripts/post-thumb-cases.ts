/**
 * Post all seven thumb-pain-encounter.v2 regression compositions as canonical JSON.
 * Requires OPENEHR_BASE_URL and OPENEHR_EHR_ID. Optional OPENEHR_BASIC_AUTH (user:pass).
 */
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { postCanonicalComposition, type CdrPostResult } from "../src/openehr/post.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { ferroRegressionCases } from "../tests/ferro-cases-data.ts";

function basicAuthHeader(): string | undefined {
  const raw = process.env.OPENEHR_BASIC_AUTH?.trim();
  if (!raw) return undefined;
  const token = Buffer.from(raw, "utf8").toString("base64");
  return `Basic ${token}`;
}

async function main(): Promise<void> {
  const baseUrl = process.env.OPENEHR_BASE_URL?.trim();
  const ehrId = process.env.OPENEHR_EHR_ID?.trim();
  if (!baseUrl || !ehrId) {
    throw new Error("OPENEHR_BASE_URL and OPENEHR_EHR_ID must be set to post compositions to a CDR");
  }
  const authHeader = basicAuthHeader();
  const results: CdrPostResult[] = [];

  for (const item of ferroRegressionCases) {
    const built = buildThumbEncounter(item.state, item.narrative);
    const checked = await validateComposition(built.canonical);
    if (!checked.valid) {
      throw new Error(`${item.id}: canonical validation failed: ${JSON.stringify(checked.errors)}`);
    }
    const posted = await postCanonicalComposition(baseUrl, ehrId, built.canonical, { authHeader });
    results.push({ caseId: item.id, ...posted });
    console.log(`${item.id}\t${posted.status}\t${posted.statusText}`);
    if (posted.status < 200 || posted.status >= 300) {
      console.error(posted.body.slice(0, 500));
    }
  }

  const failed = results.filter((r) => r.status < 200 || r.status >= 300);
  if (failed.length) {
    throw new Error(`${failed.length} composition post(s) failed`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});