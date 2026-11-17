import optXml from "../../templates/thumb-pain.opt?raw";
import {
  XmlDeserializer,
  XmlSerializer,
  parser,
  resolveCdrProfile,
  serialization,
} from "../../vendor/ehrtslib/ehrtslib-0.13.0.min.js";

export type CdrProfile = "better" | "ehrbase" | "ferroehr";

const operationalTemplate = parser.parseOptXml(optXml).operationalTemplate;

export type SimplifiedViewFlavour = "flat" | "structured";

const xmlSerializer = new XmlSerializer({
  prettyPrint: true,
  includeDeclaration: true,
});
const xmlDeserializer = new XmlDeserializer();
const jsonDeserializer = new serialization.JsonConfigurableDeserializer(
  serialization.CANONICAL_JSON_DESERIALIZE_CONFIG,
);
const jsonSerializer = new serialization.JsonConfigurableSerializer(
  serialization.CANONICAL_JSON_CONFIG,
);

function webTemplateForProfile(profile: CdrProfile) {
  const resolved = resolveCdrProfile({ cdrProfile: profile });
  return serialization.buildWebTemplate(operationalTemplate, resolved.webTemplate);
}

function typedInstance(canonical: Record<string, unknown>): unknown {
  return jsonDeserializer.deserialize(JSON.stringify(canonical));
}

export function canonicalToXml(canonical: Record<string, unknown>): string {
  const instance = typedInstance(canonical);
  return xmlSerializer.serialize(instance);
}

export function xmlToCanonicalRecord(xml: string): Record<string, unknown> {
  const instance = xmlDeserializer.deserialize(xml);
  const json = jsonSerializer.serialize(instance);
  return JSON.parse(json) as Record<string, unknown>;
}

export function canonicalToSimplifiedJson(
  canonical: Record<string, unknown>,
  profile: CdrProfile,
  flavour: SimplifiedViewFlavour,
): string {
  const resolved = resolveCdrProfile({ cdrProfile: profile });
  const webTemplate = webTemplateForProfile(profile);
  const instance = typedInstance(canonical);
  if (flavour === "flat") {
    return serialization.serializeToFlatJson(instance, webTemplate, {
      ...resolved.flat,
      prettyPrint: true,
    });
  }
  return serialization.serializeToStructuredJson(instance, webTemplate, {
    prettyPrint: true,
    flavor: resolved.flat.flavor ?? "output",
  });
}