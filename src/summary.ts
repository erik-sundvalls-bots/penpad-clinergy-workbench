import type { FormLink } from "./knowledge.ts";
import { painForm } from "./knowledge.ts";
import type { NoteLanguage } from "./exam/phrases.ts";
import type { Finding } from "../vendor/sentence.ts";
import { knowledge } from "./knowledge.ts";
import { render } from "../vendor/sentence.ts";
import { renderSwedishGp } from "./sv/gp-sentence.ts";

export function isAssessmentTopic(topic: string, diagnoses: FormLink[] = painForm.diagnoses): boolean {
  return diagnoses.some(
    (link) => topic === link.item || topic === link.preCoordinated || topic === link.concept,
  );
}

/** Drop trailing ", present" from Clinergy summary sentences in the UI. */
export function formatEnglishSummaryLine(line: string): string {
  const trimmed = line.replace(/, present\s*$/i, "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function historyFindings(findings: Finding[]): Finding[] {
  return findings.filter((finding) => !isAssessmentTopic(finding.topic));
}

export function historyNarrativeText(
  findings: Finding[],
  language: NoteLanguage = "en",
): string {
  const history = historyFindings(findings);
  if (language === "sv") {
    return history.map((finding) => renderSwedishGp(finding)).join("\n");
  }
  return history.map((finding) => formatEnglishSummaryLine(render(finding, knowledge))).join("\n");
}

export function summaryLines(findings: Finding[], language: NoteLanguage = "en"): string[] {
  if (language === "sv") return findings.map((finding) => renderSwedishGp(finding));
  return findings.map((finding) => formatEnglishSummaryLine(render(finding, knowledge)));
}