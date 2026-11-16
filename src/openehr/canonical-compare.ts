const LOCATABLE_ARRAY_KEYS = new Set(["content", "items", "events", "activities"]);

/** Align ZipEHR html5 round-trip JSON with workbench canonical shorthand (e.g. composer `name` string). */
export function alignWorkbenchCanonicalShorthand(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(alignWorkbenchCanonicalShorthand);
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (
      key === "name" &&
      record._type === "ELEMENT" &&
      child &&
      typeof child === "object" &&
      !Array.isArray(child) &&
      (child as { _type?: string })._type === "DV_CODED_TEXT" &&
      typeof (child as { value?: string }).value === "string"
    ) {
      out[key] = { _type: "DV_TEXT", value: (child as { value: string }).value };
      continue;
    }
    if (
      key === "name" &&
      record._type === "PARTY_IDENTIFIED" &&
      child &&
      typeof child === "object" &&
      !Array.isArray(child) &&
      (child as { _type?: string })._type === "DV_TEXT" &&
      typeof (child as { value?: string }).value === "string"
    ) {
      out[key] = (child as { value: string }).value;
      continue;
    }
    out[key] = alignWorkbenchCanonicalShorthand(child);
  }
  return out;
}

function locatableSortKey(node: Record<string, unknown>): string {
  const id = node.archetype_node_id;
  return typeof id === "string" ? id : "";
}

/** ZipEHR html5 deserialize may reorder sibling `items`/`events`; sort for stable compare. */
export function stabilizeLocatableArrays(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    const mapped = value.map(stabilizeLocatableArrays);
    if (
      mapped.every(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          "archetype_node_id" in (entry as object),
      )
    ) {
      return [...(mapped as Record<string, unknown>[])].sort((a, b) =>
        locatableSortKey(a).localeCompare(locatableSortKey(b)),
      );
    }
    return mapped;
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (LOCATABLE_ARRAY_KEYS.has(key) && Array.isArray(child)) {
      out[key] = stabilizeLocatableArrays(child);
    } else {
      out[key] = stabilizeLocatableArrays(child);
    }
  }
  return out;
}

export function comparableCanonical(value: unknown): unknown {
  return stabilizeLocatableArrays(alignWorkbenchCanonicalShorthand(value));
}