import { serialization } from "../../vendor/ehrtslib/ehrtslib-0.12.0.min.js";
import { webTemplate } from "./webtemplate.ts";

export interface ValidationIssue {
  path: string;
  message: string;
  severity: string;
}

export interface FlatValidation {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function validateFlat(flat: Record<string, string>): FlatValidation {
  return serialization.validateFlatPayload(flat, webTemplate, { strictUnknownKeys: true });
}
