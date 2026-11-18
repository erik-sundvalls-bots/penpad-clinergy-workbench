import type { Finding } from "../vendor/sentence.ts";

/**
 * When a finding is explicitly absent, Clinergy keeps only site/laterality in the
 * summary sentence; descriptor answers (onset, severity, duration, …) are ignored.
 * @see data/sentence-rules.yaml (hasClinicalAbsence beforeTopic, no other qualifiers in fixtures)
 */
export function findingForSentence(finding: Finding): Finding {
  if (finding.summary !== "absence") return finding;
  return { ...finding, qualifiers: [] };
}