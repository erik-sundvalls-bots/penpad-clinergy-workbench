import { snomedMap } from "../knowledge.ts";
import type { Finding } from "../../vendor/sentence.ts";
import type { SnomedMap } from "../../vendor/snomed.ts";
import { expressionFor } from "./expressions.ts";

/**
 * A SNOMED CT expression for one finding in a generated narrative block.
 * `match` follows openEHR TERM_MAPPING: "=" when the expression says all the
 * block says, ">" (target broader) when the block says more.
 */
export interface NarrativeMapping {
  topic: string;
  expression: string;
  match: "=" | ">";
}

/**
 * The expression only states that the finding is present, so absent or
 * possible findings get none.
 */
function asserted(finding: Finding): boolean {
  return finding.summary == null || finding.summary === "presence";
}

/**
 * One mapping per finding rendered in the block, built with the same
 * `expressionFor()` as the SNOMED sidebar. Findings without a verified focus
 * are skipped. The match is "=" only when the block renders one finding and
 * nothing in it is unmapped.
 */
export function narrativeMappings(findings: Finding[], map: SnomedMap = snomedMap): NarrativeMapping[] {
  const out: NarrativeMapping[] = [];
  for (const finding of findings) {
    if (!asserted(finding)) continue;
    const result = expressionFor(finding, map);
    if (!result.expression) continue;
    const complete = findings.length === 1 && result.unmapped.length === 0;
    out.push({ topic: finding.topic, expression: result.expression, match: complete ? "=" : ">" });
  }
  return out;
}
