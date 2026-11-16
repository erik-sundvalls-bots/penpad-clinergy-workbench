export function serializeToHtml5Variant(
  obj: unknown,
  variant: "zipehr.html5.short" | "zipehr.html5.full" | "zipehr.html5.emoji",
  options?: {
    symbolVariant?: "emoji" | "lettercode";
    layout?: "oneliner" | "linesaving" | "fluffy";
    propertyMode?: "omit" | "attribute" | "comment";
  },
): Promise<string>;

export function zipehrHtml5ToCanonical(html: string): unknown;

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
  serializeToFlat(
    instance: unknown,
    webTemplate: unknown,
    options?: { locatableName?: "omit" | "include"; flavor?: "input" },
  ): Record<string, string | boolean>;
  buildWebTemplate(opt: unknown): { templateId?: string; tree: { id: string; children?: unknown[] } };
};
export const validation: {
  RMSpecificationValidator: new () => {
    validate(value: unknown): { path?: string; message?: string; severity?: string }[];
    validateInstance(value: unknown, rmType?: string, path?: string): unknown[];
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
  InvariantEvaluator: new () => {
    validateInvariants(value: unknown, invariants?: unknown): unknown[];
  };
};
