import optXml from "../../templates/thumb-pain.opt?raw";
import { parser, serialization, validation } from "../../vendor/ehrtslib/ehrtslib-0.13.0.min.js";

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

const operationalTemplate = parser.parseOptXml(optXml).operationalTemplate;

const templateValidator = new validation.TemplateValidator({
  validateUnits: false,
  validateInvariants: true,
  validateTerminology: true,
});

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

  const templateResult = templateValidator.validate(typed, operationalTemplate);
  errors.push(...asIssues(templateResult.errors, "error"));
  warnings.push(...asIssues(templateResult.warnings, "warning"));
  return { valid: errors.length === 0, errors, warnings };
}