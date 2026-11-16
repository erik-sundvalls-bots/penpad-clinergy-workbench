export const parser: {
  parseOptXml(xml: string): { operationalTemplate: unknown; warnings?: unknown[] };
  isOptXml(xml: string): boolean;
};
export const serialization: {
  validateFlatPayload(
    payload: Record<string, string>,
    webTemplate: unknown,
    options?: { strictUnknownKeys?: boolean },
  ): {
    valid: boolean;
    errors: { path: string; message: string; severity: string }[];
    warnings: { path: string; message: string; severity: string }[];
  };
  toTypedRm(value: unknown): unknown;
  buildWebTemplate(opt: unknown): { templateId?: string; tree: { id: string; children?: unknown[] } };
};
export const validation: {
  RMSpecificationValidator: new () => {
    validate(value: unknown, rmTypeName?: string, attributeName?: string, path?: string): unknown[];
    validateInstance(value: unknown, rmType: string, path?: string): unknown[];
  };
  TemplateValidator: new (config?: {
    validateUnits?: boolean;
    validateInvariants?: boolean;
    validateTerminology?: boolean;
  }) => {
    validate(rmInstance: unknown, template: unknown): {
      valid: boolean;
      errors?: unknown[];
      warnings?: unknown[];
    };
  };
};
