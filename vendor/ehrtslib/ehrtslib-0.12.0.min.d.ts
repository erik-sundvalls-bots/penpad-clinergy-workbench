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
};
export const validation: {
  RMSpecificationValidator: new () => { validate(value: unknown): { errors?: unknown[]; warnings?: unknown[] } | unknown[] };
  InvariantEvaluator: new () => { validateInvariants(value: unknown): { errors?: unknown[] } };
};
