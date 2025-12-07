import { Trans, useTranslation } from "react-i18next";
import type { ReactNode } from "react";

export type INaturalistVisualizationType = "points" | "grid" | "heatmap";

function LegendRow({ swatch, label }: { swatch: ReactNode; label: ReactNode }) {
  return (
    <div className="flex items-start space-x-2">
      <div className="flex-none mt-0.5">{swatch}</div>
      <span className="flex-1 text-xs sm:text-sm text-gray-800 leading-snug break-words">
        {label}
      </span>
    </div>
  );
}

export function INaturalistSourceLink() {
  const { t } = useTranslation("homepage");

  return (
    <div className="flex items-center space-x-2">
      <img
        src="/logos/inaturalist-bird.png"
        alt="iNaturalist"
        className="w-4 h-4 -mt-0.5"
      />
      <a
        href="https://inaturalist.org"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-500 hover:underline"
      >
        {t("Data from iNaturalist.org")}
      </a>
    </div>
  );
}

export default function INaturalistLegendContent({
  type,
}: {
  type: INaturalistVisualizationType;
}) {
  const { t } = useTranslation("homepage");

  if (type === "grid") {
    return (
      <div className="space-y-3">
        <div className="text-[0.7rem] uppercase tracking-wide font-semibold text-gray-500">
          <Trans ns="homepage">Grid Display</Trans>
        </div>
        <div className="space-y-1">
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span className="inline-block w-5 h-5 bg-[#ff6600]/30 border border-[#ff6600]" />
            }
            label={t("Fewer observations per grid cell")}
          />
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span className="inline-block w-5 h-5 bg-[#ff6600]/70 border border-[#ff6600]" />
            }
            label={t("More observations per grid cell")}
          />
        </div>
        <p className="text-xs text-gray-500">
          <Trans ns="homepage">
            Grid cells show observation density, not species density or
            distribution.
          </Trans>
        </p>
        <INaturalistSourceLink />
      </div>
    );
  }

  if (type === "heatmap") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <div
            // eslint-disable-next-line i18next/no-literal-string
            className="h-3 w-full rounded-sm border border-black/10"
            style={{
              background:
                "linear-gradient(90deg, #2a6fdb 0%, #05c46b 40%, #ffd32a 75%, #ff3f34 100%)",
            }}
          />
          <div className="flex justify-between text-[0.7rem] text-gray-600">
            <span>{t("Fewer observations")}</span>
            <span>{t("More observations")}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          <Trans ns="homepage">
            Heatmap shows observation density, not species density or
            distribution.
          </Trans>
        </p>
        <INaturalistSourceLink />
      </div>
    );
  }

  // type === "points": show geoprivacy and taxonomic groups (point symbology)
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-[0.7rem] uppercase tracking-wide font-semibold text-gray-500">
          <Trans ns="admin:data">Geoprivacy</Trans>
        </div>
        <div className="space-y-1">
          <LegendRow
            swatch={
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
              </span>
            }
            label={t("Open")}
          />
          <LegendRow
            swatch={
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 bg-gray-300">
                <span className="w-2 h-2 rounded-full bg-gray-100" />
              </span>
            }
            label={t("Obscured")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[0.7rem] uppercase tracking-wide font-semibold text-gray-500">
          <Trans ns="admin:data">Taxonomic Groups</Trans>
        </div>
        <div className="space-y-1">
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "#1e90ff" }}
              />
            }
            label={t(
              "Amphibians, Birds, Fishes, Mammals, Reptiles, Other Animals"
            )}
          />
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "#ff6600" }}
              />
            }
            label={t("Mollusks, Arachnids, Insects")}
          />
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "#66bb00" }}
              />
            }
            label={t("Plants")}
          />
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "#ff00aa" }}
              />
            }
            label={t("Fungi")}
          />
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "#9b5c25" }}
              />
            }
            label={t("Chromista")}
          />
          <LegendRow
            swatch={
              // eslint-disable-next-line i18next/no-literal-string
              <span
                className="inline-block w-3.5 h-3.5 rounded-sm"
                style={{ backgroundColor: "#7b2cff" }}
              />
            }
            label={t("Protozoans")}
          />
          <LegendRow
            swatch={
              <span className="inline-block w-3.5 h-3.5 rounded-sm border border-gray-600 border-dashed bg-white" />
            }
            label={t("Unknown")}
          />
        </div>
        <INaturalistSourceLink />
      </div>
    </div>
  );
}
