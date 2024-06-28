import { RasterBandInfo } from "@seasketch/geostats-types";
import * as Editors from "./Editors";
import { useTranslation } from "react-i18next";
import { Expression } from "mapbox-gl";
import { useState } from "react";
import { LayerPropertyUpdater } from "./GUIStyleEditor";
export default function ContinuousRasterStepsEditor({
  band,
  expression,
  metadata,
  updateLayerProperty,
}: {
  band: RasterBandInfo;
  expression: Expression;
  metadata?: Editors.SeaSketchLayerMetadata;
  updateLayerProperty: LayerPropertyUpdater;
}) {
  const { t } = useTranslation("admin:data");
  const [steps, setSteps] = useState<string>(
    determineSteps(expression, band, metadata)
  );

  function isDisabled(key: string) {
    return (
      !(key in band.stats) || Object.keys((band.stats as any)[key]).length === 0
    );
  }

  return (
    <>
      <Editors.Root>
        <Editors.Label title={t("Steps")} />
        <Editors.Control>
          <select
            className="bg-gray-700 rounded text-sm py-1"
            value={determineSteps(expression, band, metadata)}
            onChange={(e) => {
              setSteps(e.target.value);
              if (e.target.value === "continuous") {
              } else if (e.target.value === "manual") {
              } else {
                console.log((band.stats as any)[e.target.value]);
              }
            }}
          >
            <option value="continuous">{t("Continuous")}</option>
            <hr></hr>
            <option
              disabled={isDisabled("naturalBreaks")}
              value="naturalBreaks"
            >
              {t("Natural Breaks")}
            </option>
            <option
              disabled={isDisabled("equalInterval")}
              value="equalInterval"
            >
              {t("Equal Interval")}
            </option>
            <option disabled={isDisabled("quantiles")} value="quantiles">
              {t("Quantiles")}
            </option>
            <option
              disabled={isDisabled("standardDeviations")}
              value="standardDeviations"
            >
              {t("Standard Deviation")}
            </option>
            <option disabled={isDisabled("geometric")} value="geometric">
              {t("Geometric")}
            </option>
            {steps === "manual" && (
              <option value="manual">{t("Manual")}</option>
            )}
          </select>
        </Editors.Control>
      </Editors.Root>
      {steps !== "continuous" && (
        <Editors.Root>
          <Editors.Label title={t("Number of Steps")} />
          <Editors.Control>
            <select className="bg-gray-700 rounded text-sm py-1">
              {Object.keys((band.stats as any)[steps]).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </Editors.Control>
        </Editors.Root>
      )}
    </>
  );
}

function determineSteps(
  expression: Expression,
  band: RasterBandInfo,
  metadata?: Editors.SeaSketchLayerMetadata
) {
  const fnName = expression[0];
  if (/interpolate/.test(fnName)) {
    return "continuous";
  } else if (fnName === "step") {
    // TODO: look for type in metadata
    // If present, validate values against expression and band stats
    // if not matching, return manual
    // otherwise return the metadata value
    return "quantiles";
  } else {
    return "manual";
  }
}
