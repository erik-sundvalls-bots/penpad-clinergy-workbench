/**
 * Captions, unit families, and defaults for quantity rows.
 *
 * Captions for the past-history time bars were observed on the original
 * engine form (s98): "how long ago?" and "lasting how long?". Unit
 * families come from the extract concept tree (value type → *Unit
 * subtypes). Default units are the ones the original numeric bars use
 * (per minute, mmHg, days, …).
 */

/** Original-engine field captions, keyed by feature / criterial link. */
export const FEATURE_CAPTIONS: Record<string, string> = {
  QuantityStartTime: "how long ago?",
  QuantityLengthOfHistory: "lasting how long?",
  QuantityDuration: "Duration",
  QuantityTimeOcc: "time since occurrence",
  QuantityMensesDuration: "menses duration",
  QuantityMensesFrequency: "cycle length",
  QuantityFrequency: "frequency",
  QuantityCount: "number",
  QuantityWidth: "width",
  QuantityLongitude: "length",
  QuantityHeight: "height",
  QuantityCircumference: "circumference",
  QuantityWalkingDistance: "walking distance",
  AbsoluteHistoricalPattern: "pattern",
  hasQuantity: "",
  hasManyValuedQuantity: "",
  hasLevel: "",
  hasTrendInState: "trend",
  hasChangeInState: "change",
};

export const TEMPORAL_UNITS = ["second", "minute", "hour", "day", "week", "month", "year"] as const;
export type TemporalUnit = (typeof TEMPORAL_UNITS)[number];

/** Surface labels for stored temporal unit ids (singular, matching the existing duration UI). */
export const TEMPORAL_UNIT_LABEL: Record<string, string> = {
  second: "seconds",
  minute: "minutes",
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
  year: "years",
};

export interface UnitOption {
  /** Stored id (concept name, or singular temporal id). */
  id: string;
  display: string;
}

export interface QuantitySpec {
  caption: string;
  units: UnitOption[];
  defaultUnit: string;
  /** True when the unit list is the standard duration list. */
  temporal: boolean;
}

const VALUE_UNIT_FAMILY: Record<string, string> = {
  TemporalValue: "temporal",
  PastHistoryValue: "temporal",
  FrequencyValue: "frequency",
  PulseRateValue: "frequency",
  HeartRateValue: "frequency",
  RespiratoryRateValue: "frequency",
  PressureValue: "pressure",
  SystolicBPValue: "pressure",
  DiastolicBPValue: "pressure",
  TemperatureValue: "temperature",
  MassValue: "mass",
  BodyMassValue: "mass",
  LengthValue: "length",
  DistanceValue: "length",
  BodyHeightValue: "length",
  QuantityWidth: "length",
  CircumferenceValue: "length",
  FlowRateValue: "flow",
};

const FAMILY_UNITS: Record<string, UnitOption[]> = {
  temporal: TEMPORAL_UNITS.map((id) => ({ id, display: TEMPORAL_UNIT_LABEL[id] ?? `${id}s` })),
  frequency: [
    { id: "perMinute", display: "per minute" },
    { id: "perSecond", display: "per second" },
    { id: "perHour", display: "per hour" },
    { id: "perDay", display: "per day" },
    { id: "perNight", display: "per night" },
    { id: "perWeek", display: "per week" },
    { id: "perMonth", display: "per month" },
    { id: "perYear", display: "per year" },
  ],
  pressure: [{ id: "millimetresOfMercury", display: "mmHg" }],
  temperature: [
    { id: "Celsius", display: "celsius" },
    { id: "Fahrenheit", display: "fahrenheit" },
    { id: "Kelvin", display: "kelvin" },
  ],
  mass: [
    { id: "kilograms", display: "kg" },
    { id: "grams", display: "grams" },
    { id: "milligrams", display: "milligrams" },
  ],
  length: [
    { id: "millimetres", display: "mm" },
    { id: "centimetres", display: "cm" },
    { id: "metres", display: "metres" },
  ],
  flow: [
    { id: "litresPerMinute", display: "litres per minute" },
    { id: "mlsPerDay", display: "mls per day" },
  ],
};

const FAMILY_DEFAULT: Record<string, string> = {
  temporal: "day",
  frequency: "perMinute",
  pressure: "millimetresOfMercury",
  temperature: "Celsius",
  mass: "kilograms",
  length: "centimetres",
  flow: "litresPerMinute",
};

export function familyForValue(value: string | undefined, feature?: string): string | null {
  if (value && VALUE_UNIT_FAMILY[value]) return VALUE_UNIT_FAMILY[value];
  if (feature && (feature === "QuantityDuration" || feature === "QuantityStartTime" || feature === "QuantityLengthOfHistory" || feature === "QuantityTimeOcc" || feature === "QuantityMensesDuration" || feature === "QuantityMensesFrequency" || /Duration|Time|History/.test(feature))) {
    return "temporal";
  }
  if (value && /RateValue$/.test(value)) return "frequency";
  if (value && /BPValue$|PressureValue$/.test(value)) return "pressure";
  if (value && /Temperature/.test(value)) return "temperature";
  if (value && /MassValue$|Weight/.test(value)) return "mass";
  if (value && /FlowRate/.test(value)) return "flow";
  return null;
}

export function quantitySpec(feature: string | undefined, values: unknown[]): QuantitySpec {
  const tokens = values.filter((v): v is string => typeof v === "string");
  const family = familyForValue(tokens[0], feature) ?? "temporal";
  const units = FAMILY_UNITS[family] ?? FAMILY_UNITS.temporal;
  const defaultUnit = FAMILY_DEFAULT[family] ?? "day";
  const caption = featureCaption(feature);
  return { caption, units, defaultUnit, temporal: family === "temporal" };
}

export function featureCaption(feature: string | undefined): string {
  if (!feature) return "";
  if (feature in FEATURE_CAPTIONS) return FEATURE_CAPTIONS[feature];
  return feature.replace(/^has/, "").replace(/^Absolute/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toLowerCase()).trim();
}

export function isQuantityValueToken(value: unknown): boolean {
  return typeof value === "string" && /Value$/.test(value);
}

export function isManyValuedQuantity(row: { feature?: string; values?: unknown[] }): boolean {
  return row.feature === "hasManyValuedQuantity" || (row.values ?? []).filter(isQuantityValueToken).length > 1;
}

export function quantityTokens(row: { values?: unknown[] }): string[] {
  return (row.values ?? []).filter(isQuantityValueToken) as string[];
}

/** Human caption for a many-valued quantity token, e.g. SystolicBPValue → "systolic BP". */
export function quantityTokenCaption(token: string, display?: string | null): string {
  if (display) return display;
  return token.replace(/Value$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/BP/g, "BP").toLowerCase().replace("bp", "BP");
}
