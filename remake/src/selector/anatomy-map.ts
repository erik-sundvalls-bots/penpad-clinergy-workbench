import type { BodyMapData } from "../knowledge-data.ts";
import { anatomyMapFor } from "./hit.ts";

/** The first OptionButton in Onelist.ini, and the remake's starting system when a selector opens. */
export const DEFAULT_SYSTEM = "FunctionalSystem";

export type SelectorTsFlag = "disease" | "symptom";

/**
 * Map name for a selector + sex + system filter, from the pack's OptionButton anatomyMap.
 * Falls back to the pack's default male/female surface map when no option matches.
 */
export function mapNameForSelector(
  data: BodyMapData,
  tsFlagType: SelectorTsFlag,
  sex: "M" | "F",
  system: string,
): string {
  const selector = data.selectors.find((s) => s.tsFlagType === tsFlagType) ?? data.selectors[0];
  const opt = selector?.options.find((o) => o.sex === sex && o.system === system);
  if (opt?.anatomyMap) return opt.anatomyMap;
  return anatomyMapFor(data, sex === "F" ? "female" : "male");
}

export function tsFlagForKind(kind: "DIS" | "SYM" | "QDE" | "CHK" | "FH" | "PMH" | "INT"): SelectorTsFlag {
  return kind === "DIS" ? "disease" : "symptom";
}
