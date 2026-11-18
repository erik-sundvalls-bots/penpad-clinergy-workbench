import optXml from "../../templates/thumb-pain.opt?raw";
import type { CdrProfile, SimplifiedViewFlavour } from "./view-types.ts";
import { loadEhrtslib, type EhrtslibModule } from "./ehrtslib-loader.ts";

export type { CdrProfile, SimplifiedViewFlavour };

interface SerializationDeps {
  vendor: EhrtslibModule;
  operationalTemplate: unknown;
  xmlSerializer: InstanceType<EhrtslibModule["XmlSerializer"]>;
  xmlDeserializer: InstanceType<EhrtslibModule["XmlDeserializer"]>;
  jsonDeserializer: InstanceType<EhrtslibModule["serialization"]["JsonConfigurableDeserializer"]>;
  jsonSerializer: InstanceType<EhrtslibModule["serialization"]["JsonConfigurableSerializer"]>;
}

let depsPromise: Promise<SerializationDeps> | null = null;

function loadDeps(): Promise<SerializationDeps> {
  if (!depsPromise) {
    depsPromise = loadEhrtslib().then((vendor) => {
      const operationalTemplate = vendor.parser.parseOptXml(optXml).operationalTemplate;
      const xmlSerializer = new vendor.XmlSerializer({
        prettyPrint: true,
        includeDeclaration: true,
      });
      const xmlDeserializer = new vendor.XmlDeserializer();
      const jsonDeserializer = new vendor.serialization.JsonConfigurableDeserializer(
        vendor.serialization.CANONICAL_JSON_DESERIALIZE_CONFIG,
      );
      const jsonSerializer = new vendor.serialization.JsonConfigurableSerializer(
        vendor.serialization.CANONICAL_JSON_CONFIG,
      );
      return {
        vendor,
        operationalTemplate,
        xmlSerializer,
        xmlDeserializer,
        jsonDeserializer,
        jsonSerializer,
      };
    });
  }
  return depsPromise;
}

function webTemplateForProfile(deps: SerializationDeps, profile: CdrProfile) {
  const resolved = deps.vendor.resolveCdrProfile({ cdrProfile: profile });
  return deps.vendor.serialization.buildWebTemplate(deps.operationalTemplate, resolved.webTemplate);
}

function typedInstance(deps: SerializationDeps, canonical: Record<string, unknown>): unknown {
  return deps.jsonDeserializer.deserialize(JSON.stringify(canonical));
}

export async function canonicalToXml(canonical: Record<string, unknown>): Promise<string> {
  const deps = await loadDeps();
  const instance = typedInstance(deps, canonical);
  return deps.xmlSerializer.serialize(instance);
}

export async function xmlToCanonicalRecord(xml: string): Promise<Record<string, unknown>> {
  const deps = await loadDeps();
  const instance = deps.xmlDeserializer.deserialize(xml);
  const json = deps.jsonSerializer.serialize(instance);
  return JSON.parse(json) as Record<string, unknown>;
}

export async function canonicalToSimplifiedJson(
  canonical: Record<string, unknown>,
  profile: CdrProfile,
  flavour: SimplifiedViewFlavour,
): Promise<string> {
  const deps = await loadDeps();
  const resolved = deps.vendor.resolveCdrProfile({ cdrProfile: profile });
  const webTemplate = webTemplateForProfile(deps, profile);
  const instance = typedInstance(deps, canonical);
  if (flavour === "flat") {
    return deps.vendor.serialization.serializeToFlatJson(instance, webTemplate, {
      ...resolved.flat,
      prettyPrint: true,
    });
  }
  return deps.vendor.serialization.serializeToStructuredJson(instance, webTemplate, {
    prettyPrint: true,
    flavor: resolved.flat.flavor ?? "output",
  });
}