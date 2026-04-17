import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { ReportWidget } from "../widgets";
import { useSubjectReportContext } from "../../context/SubjectReportContext";
import {
  calculateLOP,
  LOPLevel,
  tryParseMpaGuideAllowedUses,
} from "./levelOfProtectionCalculator";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../../editor/TooltipMenu";

type MpaGuideLevelOfProtectionSettings = Record<string, never>;

const LOP_COLORS: Record<LOPLevel, string> = {
  fully: "#215DAB",
  highly: "#119EDA",
  lightly: "#8FC84F",
  minimally: "#2F8A40",
  incompatible: "#939598",
};

function valuesByExportIdFromUserAttributes(
  userAttributes: unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!Array.isArray(userAttributes)) return out;
  for (const row of userAttributes) {
    if (!row || typeof row !== "object") continue;
    const { exportId, value } = row as {
      exportId?: unknown;
      value?: unknown;
    };
    if (typeof exportId !== "string" || !exportId) continue;
    out[exportId] = value;
  }
  return out;
}

function lopLevelLabel(level: LOPLevel, t: (key: string) => string): string {
  switch (level) {
    case "fully":
      return t("Fully Protected");
    case "highly":
      return t("Highly Protected");
    case "lightly":
      return t("Lightly Protected");
    case "minimally":
      return t("Minimally Protected");
    case "incompatible":
      return t("Incompatible with the conservation of nature");
  }
}

function LopLevelDescription({ level }: { level: LOPLevel }) {
  const { t } = useTranslation("reports");
  switch (level) {
    case "fully":
      return (
        <p className="text-sm text-gray-800 leading-relaxed">
          {t(
            "No impact from extractive or destructive activities is allowed and all abatable impacts are minimized. "
          )}
        </p>
      );
    case "highly":
      return (
        <p className="text-sm text-gray-800 leading-relaxed">
          {t(
            "Only light extractive activities are allowed that have low impact, and all other abatable impacts are minimized."
          )}
        </p>
      );
    case "lightly":
      return (
        <p className="text-sm text-gray-800 leading-relaxed">
          {t(
            "Some protection of biodiversity exists but extractive or destructive activities occur that can have moderate impact. "
          )}
        </p>
      );
    case "minimally":
      return (
        <p className="text-sm text-gray-800 leading-relaxed">
          {t(
            "Extensive extraction and other activities with high total impact occur, but the site can still be considered an MPA by IUCN criteria and provides some conservation benefit."
          )}
        </p>
      );
    case "incompatible":
      return (
        <p className="text-sm text-gray-800 leading-relaxed">
          <Trans ns="reports">
            This zone is ‘incompatible with the conservation of nature’ per IUCN
            Guidelines. For example, it may include mining or industrial fishing
            activities.{" "}
          </Trans>
        </p>
      );
  }
}

export const MpaGuideLevelOfProtection: ReportWidget<
  MpaGuideLevelOfProtectionSettings
> = () => {
  const { t } = useTranslation("reports");
  const subjectReportContext = useSubjectReportContext();
  const sketch = subjectReportContext.data?.sketch;

  const allowedUses = useMemo(() => {
    if (!sketch?.userAttributes) return null;
    return tryParseMpaGuideAllowedUses(
      valuesByExportIdFromUserAttributes(sketch.userAttributes)
    );
  }, [sketch?.userAttributes]);

  const levelOfProtection = useMemo(() => {
    if (!allowedUses) return null;
    return calculateLOP(allowedUses);
  }, [allowedUses]);

  if (!sketch) {
    return null;
  }

  if (!levelOfProtection) {
    return (
      <div className="my-2 border border-amber-200/80 rounded-lg bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950">
        <Trans ns="reports">
          This summary needs all seven MPA Guide allowed-use fields on the
          sketch form, each with an export id of{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            mining
          </code>
          ,{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            dredging
          </code>
          ,{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            anchoring
          </code>
          ,{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            infrastructure
          </code>
          ,{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            aquaculture
          </code>
          ,{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            fishing
          </code>
          , and{" "}
          <code className="text-xs font-mono bg-white/80 px-1 rounded">
            nonextractive
          </code>
          , using option values from the MPA Guide decision tree. Edit the
          sketch to fill them in.
        </Trans>
      </div>
    );
  }

  const label = lopLevelLabel(levelOfProtection, t);
  const headerColor = LOP_COLORS[levelOfProtection];

  return (
    <div
      className="my-2 mt-3 border border-gray-200 rounded-md p-4"
      style={{
        backgroundColor: "rgb(245, 245, 245)",
      }}
    >
      <div
        className="rounded-lg px-4 py-3 min-h-[48px] flex items-center justify-center shadow-sm text-center text-white font-semibold text-base leading-snug"
        style={{ backgroundColor: headerColor }}
      >
        {label}
      </div>
      <div className="mt-2.5 text-center">
        <LopLevelDescription level={levelOfProtection} />
      </div>
    </div>
  );
};

export const MpaGuideLevelOfProtectionTooltipControls: ReportWidgetTooltipControls =
  () => {
    const { t } = useTranslation("admin:reports");
    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <TooltipMorePopover>
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Component Type")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
              {t("MPA Guide Level of Protection")}
            </span>
          </div>
        </TooltipMorePopover>
      </div>
    );
  };
