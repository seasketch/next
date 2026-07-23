import {
  GeostatsAttribute,
  GeostatsLayer,
} from "@seasketch/geostats-types";
import { isOverlayIdAttribute } from "./detectJoinColumn";

export type OverlayJoinColumnOptionStatus = "valid" | "close" | "invalid";

export type OverlayJoinColumnOptionReason =
  | "unsupported_type"
  | "too_few_values"
  | "duplicate_values"
  | "not_unique";

export type OverlayJoinColumnHintSource = "ai" | "computed";

export type OverlayJoinColumnOption = {
  attribute: string;
  distinctCount: number;
  featureCount: number;
  sampleValues: string[];
  status: OverlayJoinColumnOptionStatus;
  reason?: OverlayJoinColumnOptionReason;
  duplicateValueNames?: number;
  hintSource?: OverlayJoinColumnHintSource;
  isPrimaryHint?: boolean;
  rankScore: number;
};

export type OverlayJoinColumnSections = {
  suggested: OverlayJoinColumnOption[];
  other: OverlayJoinColumnOption[];
  featureCount: number;
  primaryHint?: string;
};

const CLOSE_SUGGESTED_RATIO = 0.9;

function sampleAttributeValues(attr: GeostatsAttribute, limit = 12): string[] {
  return Object.keys(attr.values || {})
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

function duplicateValueCount(attr: GeostatsAttribute): number {
  return Object.values(attr.values || {}).filter((count) => count > 1).length;
}

function cardinalityRatio(distinctCount: number, featureCount: number): number {
  if (featureCount <= 0) {
    return 0;
  }
  return distinctCount / featureCount;
}

function computeRankScore(
  status: OverlayJoinColumnOptionStatus,
  distinctCount: number,
  featureCount: number,
): number {
  const ratio = cardinalityRatio(distinctCount, featureCount);
  if (status === "valid") {
    return 10000 + distinctCount;
  }
  if (status === "close") {
    return 5000 + ratio * 1000 + distinctCount * 0.01;
  }
  return ratio * 100 + distinctCount * 0.01;
}

function analyzeAttribute(
  attr: GeostatsAttribute,
  featureCount: number,
): OverlayJoinColumnOption {
  const distinctCount =
    attr.countDistinct ?? Object.keys(attr.values || {}).length;
  const sampleValues = sampleAttributeValues(attr);

  if (attr.type !== "string" && attr.type !== "number") {
    return {
      attribute: attr.attribute,
      distinctCount,
      featureCount,
      sampleValues,
      status: "invalid",
      reason: "unsupported_type",
      rankScore: computeRankScore("invalid", distinctCount, featureCount),
    };
  }

  if (distinctCount <= 1) {
    return {
      attribute: attr.attribute,
      distinctCount,
      featureCount,
      sampleValues,
      status: "invalid",
      reason: "too_few_values",
      rankScore: computeRankScore("invalid", distinctCount, featureCount),
    };
  }

  if (isOverlayIdAttribute(attr, featureCount)) {
    return {
      attribute: attr.attribute,
      distinctCount,
      featureCount,
      sampleValues,
      status: "valid",
      rankScore: computeRankScore("valid", distinctCount, featureCount),
    };
  }

  if (distinctCount < featureCount) {
    const duplicateValueNames = duplicateValueCount(attr);
    return {
      attribute: attr.attribute,
      distinctCount,
      featureCount,
      sampleValues,
      status: "close",
      reason: "duplicate_values",
      duplicateValueNames,
      rankScore: computeRankScore("close", distinctCount, featureCount),
    };
  }

  return {
    attribute: attr.attribute,
    distinctCount,
    featureCount,
    sampleValues,
    status: "invalid",
    reason: "not_unique",
    rankScore: computeRankScore("invalid", distinctCount, featureCount),
  };
}

function normalizeHint(hint?: string | null): string | undefined {
  const trimmed = hint?.trim();
  return trimmed ? trimmed : undefined;
}

function findMatchingOption(
  options: OverlayJoinColumnOption[],
  hint?: string,
): OverlayJoinColumnOption | undefined {
  if (!hint) {
    return undefined;
  }
  const normalized = hint.toLowerCase();
  return options.find(
    (option) => option.attribute.toLowerCase() === normalized,
  );
}

function isHighlyRankedCandidate(option: OverlayJoinColumnOption): boolean {
  if (option.status === "valid") {
    return true;
  }
  if (option.status === "close") {
    return (
      cardinalityRatio(option.distinctCount, option.featureCount) >=
      CLOSE_SUGGESTED_RATIO
    );
  }
  return false;
}

export function getOverlayJoinColumnOptions(
  geostatsLayer: GeostatsLayer | undefined,
): OverlayJoinColumnOption[] {
  if (!geostatsLayer?.attributes?.length) {
    return [];
  }

  const featureCount = geostatsLayer.count;
  return geostatsLayer.attributes
    .map((attr) => analyzeAttribute(attr, featureCount))
    .sort((a, b) => b.rankScore - a.rankScore);
}

export function partitionOverlayJoinColumnOptions(
  geostatsLayer: GeostatsLayer | undefined,
  aiBestIdColumnHint?: string | null,
): OverlayJoinColumnSections {
  const options = getOverlayJoinColumnOptions(geostatsLayer);
  const featureCount = geostatsLayer?.count ?? 0;

  if (options.length === 0) {
    return { suggested: [], other: [], featureCount };
  }

  const aiHint = normalizeHint(aiBestIdColumnHint);
  const aiMatch = findMatchingOption(options, aiHint);
  const computedBest =
    aiMatch ||
    [...options].sort((a, b) => b.rankScore - a.rankScore)[0];
  const primaryHint = aiMatch?.attribute ?? computedBest?.attribute;

  const annotated = options.map((option) => {
    const isPrimaryHint = option.attribute === primaryHint;
    let hintSource: OverlayJoinColumnHintSource | undefined;
    if (isPrimaryHint) {
      hintSource = aiMatch ? "ai" : "computed";
    }
    return {
      ...option,
      isPrimaryHint,
      hintSource,
    };
  });

  const suggestedAttributes = new Set<string>();
  const suggested: OverlayJoinColumnOption[] = [];

  const pushSuggested = (option: OverlayJoinColumnOption | undefined) => {
    if (!option || suggestedAttributes.has(option.attribute)) {
      return;
    }
    suggestedAttributes.add(option.attribute);
    suggested.push(option);
  };

  if (primaryHint) {
    pushSuggested(annotated.find((option) => option.attribute === primaryHint));
  }

  for (const option of annotated) {
    if (option.status === "valid") {
      pushSuggested(option);
    }
  }

  for (const option of annotated) {
    if (isHighlyRankedCandidate(option)) {
      pushSuggested(option);
    }
  }

  const other = annotated
    .filter((option) => !suggestedAttributes.has(option.attribute))
    .sort((a, b) => b.rankScore - a.rankScore);

  return {
    suggested,
    other,
    featureCount,
    primaryHint,
  };
}

export function typesCompatibleWithOverlayAttribute(
  csvValues: Set<string>,
  type: "string" | "number" | GeostatsAttribute["type"],
): boolean {
  if (type === "number") {
    for (const value of csvValues) {
      if (Number.isNaN(Number(value))) {
        return false;
      }
    }
  }
  return true;
}
