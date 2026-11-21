export function serializeToJZipehr(
  obj: unknown,
  symbolVariant?: "emoji" | "lettercode",
): Promise<string>;

export function serializeToYZipehr(
  obj: unknown,
  symbolVariant?: "emoji" | "lettercode",
): Promise<string>;

export function serializeToXZipehr(
  obj: unknown,
  options?: {
    symbolVariant?: "emoji" | "lettercode";
    layout?: "oneliner" | "linesaving" | "fluffy";
    propertyMode?: "omit" | "attribute" | "comment";
    lang?: string;
    templateRenderLang?: string;
    template?: unknown;
    archetypeRepository?: unknown;
  },
): Promise<string>;

export function zipehrTextToCanonical(text: string): unknown;

export function serializeToHtml5Variant(
  obj: unknown,
  variant: "zipehr.html5.short" | "zipehr.html5.full" | "zipehr.html5.emoji",
  options?: {
    symbolVariant?: "emoji" | "lettercode";
    layout?: "oneliner" | "linesaving" | "fluffy";
    propertyMode?: "omit" | "attribute" | "comment";
    lang?: string;
    templateRenderLang?: string;
    template?: unknown;
    archetypeRepository?: unknown;
  },
): Promise<string>;

export function zipehrHtml5ToCanonical(html: string): unknown;

export const ZIP_QUIET_STRUCTURE_CSS: "zipehr-html5-quiet-structure.css";

export function composeQuietStructureCss(
  baseCss: string,
  quietOverridesCss: string,
): string;

export function buildZipehrPreviewDocument(
  markup: string,
  css: string,
  options?: { quietStructureTooltips?: boolean },
): string;

export const ZIP_QUIET_PREVIEW_SCRIPT: string;

export class XmlSerializer {
  constructor(config?: {
    prettyPrint?: boolean;
    includeDeclaration?: boolean;
    useNamespaces?: boolean;
  });
  serialize(obj: unknown): string;
}

export class XmlDeserializer {
  constructor(config?: { strict?: boolean });
  deserialize<T = unknown>(xml: string): T;
}

export function resolveCdrProfile(options?: {
  cdrProfile?: "better" | "ehrbase" | "ferroehr";
}): {
  profile: "better" | "ehrbase" | "ferroehr";
  webTemplate: unknown;
  flat: { flavor?: string; locatableName?: string };
};

export const parser: {
  parseOptXml(xml: string): { operationalTemplate: unknown; warnings?: unknown[] };
  isOptXml(xml: string): boolean;
};
export const serialization: {
  CANONICAL_JSON_CONFIG: unknown;
  CANONICAL_JSON_DESERIALIZE_CONFIG: unknown;
  JsonConfigurableDeserializer: new (config?: unknown) => { deserialize(input: string): unknown };
  JsonConfigurableSerializer: new (config?: unknown) => { serialize(instance: unknown): string };
  JsonCanonicalSerializer: new (config?: unknown) => { serialize(instance: unknown): string };
  serializeToFlatJson(
    instance: unknown,
    webTemplate: unknown,
    options?: { prettyPrint?: boolean; flavor?: string; locatableName?: string },
  ): string;
  serializeToStructuredJson(
    instance: unknown,
    webTemplate: unknown,
    options?: { prettyPrint?: boolean; flavor?: string },
  ): string;
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
  buildWebTemplate(
    opt: unknown,
    options?: unknown,
  ): { templateId?: string; tree: { id: string; children?: unknown[] } };
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
