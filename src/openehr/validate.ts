import gpOptXml from "../../templates/gp-encounter.opt?raw";
import optXml from "../../templates/thumb-pain.opt?raw";
import { GP_TEMPLATE_ID } from "./template.ts";
import { parser, serialization, validation } from "../../vendor/ehrtslib/ehrtslib-0.14.0.min.js";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: string;
}

export interface CompositionValidation {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const thumbTemplate = parser.parseOptXml(optXml).operationalTemplate;
const gpTemplate = parser.parseOptXml(gpOptXml).operationalTemplate;

const templateValidator = new validation.TemplateValidator({
  validateUnits: false,
  validateInvariants: true,
  validateTerminology: true,
});

function templateFor(canonical: Record<string, unknown>): unknown {
  const details = canonical.archetype_details as { template_id?: { value?: string } } | undefined;
  return details?.template_id?.value === GP_TEMPLATE_ID ? gpTemplate : thumbTemplate;
}

function asIssues(value: unknown, severity: string): ValidationIssue[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item as { path?: string; message?: string; severity?: string };
    return {
      path: String(record.path ?? "/"),
      message: String(record.message ?? item),
      severity: String(record.severity ?? severity),
    };
  });
}

/** Canonical RM JSON only — no FLAT / validateFlatPayload. */
export function validateComposition(canonical: Record<string, unknown>): CompositionValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const typed = serialization.toTypedRm(canonical);
  for (const issue of asIssues(new validation.RMSpecificationValidator().validate(typed), "error")) {
    (issue.severity === "warning" ? warnings : errors).push(issue);
  }

  const templateResult = templateValidator.validate(typed, templateFor(canonical));
  errors.push(...asIssues(templateResult.errors, "error"));
  warnings.push(...asIssues(templateResult.warnings, "warning"));
  return { valid: errors.length === 0, errors, warnings };
}