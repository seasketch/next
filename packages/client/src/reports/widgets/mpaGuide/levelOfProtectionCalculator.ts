// MPA Guide Levels of Protection
export type LOPLevel =
  | "fully"
  | "highly"
  | "lightly"
  | "minimally"
  | "incompatible";

// Rules for determining the highest LOP for each activity given the allowed uses
const lop_rules = {
  mining: { no: "fully", incompatible: "incompatible" },
  dredging: {
    no: "fully",
    infrequent: "lightly",
    incompatible: "incompatible",
  },
  anchoring: {
    no: "fully",
    yes_minimal: "fully",
    yes_moderate: "lightly",
    yes_large: "minimally",
    incompatible: "incompatible",
  },
  infrastructure: {
    no: "fully",
    yes_minimal: "fully",
    yes_low: "highly",
    yes_moderate: "lightly",
    yes_large: "minimally",
    incompatible: "incompatible",
  },
  aquaculture: {
    no: "fully",
    yes_low: "highly",
    yes_semiunfed: "lightly",
    yes_semifed: "minimally",
    incompatible: "incompatible",
  },
  fishing: {
    no: "fully",
    yes_low: "highly",
    yes_moderate: "lightly",
    yes_high: "minimally",
    incompatible: "incompatible",
  },
  nonextractive: {
    no: "fully",
    yes_minimal: "fully",
    yes_moderate: "lightly",
  },
} as const;

export type LOPActivityKey = keyof typeof lop_rules;

/** Activity keys expected on sketch export IDs (see `exportId` / `generatedExportId`). */
export const LOP_ACTIVITY_KEYS: LOPActivityKey[] = [
  "mining",
  "dredging",
  "anchoring",
  "infrastructure",
  "aquaculture",
  "fishing",
  "nonextractive",
];

// The sketch LOP is the lowest LOP level of the allowed uses
const determineLowest = (levels: LOPLevel[]): LOPLevel => {
  const rank: Record<LOPLevel, number> = {
    fully: 4,
    highly: 3,
    lightly: 2,
    minimally: 1,
    incompatible: 0,
  };

  return levels.reduce((lowest, current) => {
    return rank[current] < rank[lowest] ? current : lowest;
  }, "fully" as LOPLevel);
};

// Calculates the LOP for the sketch given the allowed uses
export const calculateLOP = (
  allowedUses: Record<keyof typeof lop_rules, string>
): LOPLevel => {
  const levels = LOP_ACTIVITY_KEYS.map((activity) => {
    const rule = lop_rules[activity];
    return rule[allowedUses[activity] as keyof typeof rule] as LOPLevel;
  });

  return determineLowest(levels);
};

/**
 * Returns a complete allowed-uses map when every activity is present with a
 * value that matches the MPA Guide decision tree; otherwise null.
 */
export function tryParseMpaGuideAllowedUses(
  valuesByExportId: Record<string, unknown>
): Record<keyof typeof lop_rules, string> | null {
  const out = {} as Record<keyof typeof lop_rules, string>;
  for (const key of LOP_ACTIVITY_KEYS) {
    const v = valuesByExportId[key];
    if (typeof v !== "string" || v === "") return null;
    const rule = lop_rules[key];
    if (!(v in rule)) return null;
    out[key] = v;
  }
  return out;
}
