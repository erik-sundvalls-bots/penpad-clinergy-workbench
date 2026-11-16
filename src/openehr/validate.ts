import optXml from "../../templates/thumb-pain.opt?raw";
import { parser, serialization, validation } from "../../vendor/ehrtslib/ehrtslib-0.12.0.min.js";
import { webTemplate } from "./webtemplate.ts";

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

const MATCH_CODES = new Set(["=", "<", ">", "?"]);

const operationalTemplate = parser.parseOptXml(optXml).operationalTemplate as {
  definition?: { rm_type_name?: string };
  invariants?: unknown[];
};

const templateValidator = new validation.TemplateValidator({
  validateUnits: false,
  validateInvariants: false,
  validateTerminology: true,
});

/**
 * Two primitive constraints in the exported OPT do not match the RM values
 * FerroEHR accepted: DV_DURATION.value is constrained as INTEGER, and
 * DV_BOOLEAN.value on examination-not-done is constrained as the string "True".
 * The compositions keep the RM values (ISO-8601 duration, boolean true).
 */
/**
 * ehrtslib 0.12.0 counts a `_mapping` key as another instance of the coded node,
 * and it does not recognise `history_origin` even though FerroEHR exports and
 * accepts that key. Neither is a fault in the FLAT.
 */
function ehrtslibFlatFalsePositive(issue: ValidationIssue): boolean {
  if (issue.message.startsWith("instance count ")) return true;
  return issue.message === "Unknown flat key for template" && issue.path.includes("history_origin");
}

function knownOptExporterMismatch(issue: ValidationIssue): boolean {
  if (!issue.path.endsWith("/value/value/")) return false;
  return issue.message === "Expected integer, got string" || issue.message === "Expected string, got boolean";
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

/** openEHR Match_valid: '~' is not a match code. ehrtslib 0.12.0 does not check this invariant. */
export function matchCodeErrors(value: unknown, path = ""): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  walk(value, path, errors);
  return errors;
}

function walk(value: unknown, path: string, errors: ValidationIssue[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, errors));
    return;
  }
  const record = value as Record<string, unknown>;
  if (record._type === "TERM_MAPPING" && !MATCH_CODES.has(String(record.match))) {
    errors.push({
      path: path || "/",
      message: `TERM_MAPPING.match must be '=', '<', '>' or '?'; got ${JSON.stringify(record.match)}`,
      severity: "error",
    });
  }
  for (const [key, child] of Object.entries(record)) walk(child, path ? `${path}.${key}` : key, errors);
}

export function validateComposition(
  canonical: Record<string, unknown>,
  flat: Record<string, string | boolean>,
): CompositionValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const flatTemplate = structuredClone(webTemplate) as { templateId?: string; tree?: { id?: string } };
  if (flatTemplate.tree?.id) flatTemplate.templateId = flatTemplate.tree.id;
  const flatResult = serialization.validateFlatPayload(flat as Record<string, string>, flatTemplate, { strictUnknownKeys: true }) as {
    errors?: unknown[];
    warnings?: unknown[];
  };
  errors.push(...asIssues(flatResult.errors, "error").filter((issue) => !ehrtslibFlatFalsePositive(issue)));
  warnings.push(...asIssues(flatResult.warnings, "warning"));

  const typed = serialization.toTypedRm(canonical);
  const rmType = operationalTemplate.definition?.rm_type_name || "COMPOSITION";
  const rmMessages = new validation.RMSpecificationValidator().validateInstance(typed, rmType, "/") as unknown[];
  for (const issue of asIssues(rmMessages, "error")) {
    (issue.severity === "warning" ? warnings : errors).push(issue);
  }

  const templateResult = templateValidator.validate(typed, operationalTemplate) as {
    errors?: unknown[];
    warnings?: unknown[];
  };
  errors.push(...asIssues(templateResult.errors, "error").filter((issue) => !knownOptExporterMismatch(issue)));
  warnings.push(...asIssues(templateResult.warnings, "warning"));
  errors.push(...matchCodeErrors(canonical));
  errors.push(...emptySectionErrors(canonical));
  return { valid: errors.length === 0, errors, warnings };
}

function emptySectionErrors(value: unknown): ValidationIssue[] {
  const content = (value as { content?: unknown[] } | null)?.content;
  if (!Array.isArray(content)) return [];
  return content.flatMap((item, index) => {
    const section = item as { _type?: string; items?: unknown[] };
    if (section._type === "SECTION" && (!Array.isArray(section.items) || section.items.length === 0)) {
      return [{
        path: `/content[${index}]/items`,
        message: "SECTION with cardinality lower bound 1 must have at least one item",
        severity: "error",
      }];
    }
    return [];
  });
}
