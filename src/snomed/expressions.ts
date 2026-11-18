import { snomedMap } from "../knowledge.ts";
import type { Finding } from "../../vendor/sentence.ts";
import {
  buildExpression,
  type ExpressionResult,
  type SnomedMap,
} from "../../vendor/snomed.ts";

/**
 * Clinergy form descriptor keys for the same reviewed rows in
 * mappings/snomed.yaml (which uses the synthetic fixture names Severity,
 * Onset and Duration). LOCAL FIX, same idea as mappings/openehr.yaml.
 */
export const DESCRIPTOR_ALIASES: Record<string, string> = {
  AbsoluteSeverity: "Severity",
  AbsoluteOnset: "Onset",
  QuantityDuration: "Duration",
};

export const UNMAPPED_INFO =
  "These values likely fit better in an information model such as openEHR or FHIR.";

export interface FindingExpression extends ExpressionResult {
  topic: string;
}

export function findingForExpression(finding: Finding): Finding {
  return {
    ...finding,
    qualifiers: (finding.qualifiers ?? []).map((qualifier) => ({
      ...qualifier,
      descriptor: DESCRIPTOR_ALIASES[qualifier.descriptor] ?? qualifier.descriptor,
    })),
  };
}

export function expressionFor(finding: Finding, map: SnomedMap = snomedMap): ExpressionResult {
  return buildExpression(findingForExpression(finding), map);
}

export function expressionsFor(
  findings: Finding[],
  map: SnomedMap = snomedMap,
): FindingExpression[] {
  return findings.map((finding) => ({
    topic: finding.topic,
    ...expressionFor(finding, map),
  }));
}
