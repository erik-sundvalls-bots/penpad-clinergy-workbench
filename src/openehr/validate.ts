import gpOptXml from "../../templates/gp-encounter.opt?raw";
import optXml from "../../templates/thumb-pain.opt?raw";
import { GP_TEMPLATE_ID } from "./template.ts";
import { loadEhrtslib } from "./ehrtslib-loader.ts";

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

interface ValidatorDeps {
  templateValidator: InstanceType<Awaited<ReturnType<typeof loadEhrtslib>>["validation"]["TemplateValidator"]>;
  rmValidator: InstanceType<Awaited<ReturnType<typeof loadEhrtslib>>["validation"]["RMSpecificationValidator"]>;
  toTypedRm: Awaited<ReturnType<typeof loadEhrtslib>>["serialization"]["toTypedRm"];
  thumbTemplate: unknown;
  gpTemplate: unknown;
}

let depsPromise: Promise<ValidatorDeps> | null = null;

function loadValidatorDeps(): Promise<ValidatorDeps> {
  if (!depsPromise) {
    depsPromise = loadEhrtslib().then((vendor) => {
      const thumbTemplate = vendor.parser.parseOptXml(optXml).operationalTemplate;
      const gpTemplate = vendor.parser.parseOptXml(gpOptXml).operationalTemplate;
      const templateValidator = new vendor.validation.TemplateValidator({
        validateUnits: false,
        validateInvariants: true,
        validateTerminology: true,
      });
      return {
        templateValidator,
        rmValidator: new vendor.validation.RMSpecificationValidator(),
        toTypedRm: vendor.serialization.toTypedRm,
        thumbTemplate,
        gpTemplate,
      };
    });
  }
  return depsPromise;
}

function templateFor(deps: ValidatorDeps, canonical: Record<string, unknown>): unknown {
  const details = canonical.archetype_details as { template_id?: { value?: string } } | undefined;
  return details?.template_id?.value === GP_TEMPLATE_ID ? deps.gpTemplate : deps.thumbTemplate;
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
export async function validateComposition(
  canonical: Record<string, unknown>,
): Promise<CompositionValidation> {
  const deps = await loadValidatorDeps();
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const typed = deps.toTypedRm(canonical);
  for (const issue of asIssues(deps.rmValidator.validate(typed), "error")) {
    (issue.severity === "warning" ? warnings : errors).push(issue);
  }

  const templateResult = deps.templateValidator.validate(typed, templateFor(deps, canonical));
  errors.push(...asIssues(templateResult.errors, "error"));
  warnings.push(...asIssues(templateResult.warnings, "warning"));
  return { valid: errors.length === 0, errors, warnings };
}