import { PiiRiskCategory } from "@seasketch/geostats-types";
import { TFunction } from "react-i18next";

export const PII_REDACTION_THRESHOLD = 0.35;

/** Background + left stripe by overall PII score (0–1). */
export function piiRiskStripeClass(piiRisk: number | undefined): string {
  const r = piiRisk ?? 0;
  if (r >= 0.75) {
    return "border-l-red-500 bg-red-50/80";
  }
  if (r >= 0.55) {
    return "border-l-orange-500 bg-orange-50/70";
  }
  if (r >= PII_REDACTION_THRESHOLD) {
    return "border-l-amber-500 bg-amber-50/60";
  }
  return "border-l-yellow-500 bg-yellow-50/50";
}

export function piiRiskCategoryLabel(
  category: PiiRiskCategory,
  t: TFunction<"admin:data">
): string {
  switch (category) {
    case "email":
      return t("Email");
    case "phone":
      return t("Phone");
    case "government_id":
      return t("Government ID");
    case "financial":
      return t("Financial");
    case "name":
      return t("Name");
    case "other":
      return t("Other");
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function piiRiskDetected(piiRisk: number | undefined): boolean {
  return piiRisk !== undefined && piiRisk > 0;
}

/** Background + text only (e.g. layer-details segmented segment). */
export function piiRiskToneClass(piiRisk: number | undefined): string {
  const r = piiRisk ?? 0;
  if (r >= 0.75) {
    return "bg-red-50/20 text-red-800";
  }
  if (r >= 0.55) {
    return "bg-orange-50/20 text-orange-900";
  }
  if (r >= PII_REDACTION_THRESHOLD) {
    return "bg-amber-50/20 text-amber-900";
  }
  return "bg-yellow-50/20 text-yellow-900";
}

/** PII pill colors; pair with `rounded-full px-2.5 py-0.5 text-xs font-medium box-border border`. */
export function piiRiskBadgeClass(piiRisk: number | undefined): string {
  const tone = piiRiskToneClass(piiRisk);
  const r = piiRisk ?? 0;
  if (r >= 0.75) {
    return [tone, "box-border", "border", "border-red-200/80"].join(" ");
  }
  if (r >= 0.55) {
    return [tone, "box-border", "border", "border-orange-200/80"].join(" ");
  }
  if (r >= PII_REDACTION_THRESHOLD) {
    return [tone, "box-border", "border", "border-amber-200/80"].join(" ");
  }
  return [tone, "box-border", "border", "border-yellow-200/80"].join(" ");
}
