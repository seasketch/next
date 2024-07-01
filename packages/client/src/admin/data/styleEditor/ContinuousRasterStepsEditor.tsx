import { Bucket, RasterBandInfo } from "@seasketch/geostats-types";
import * as Editors from "./Editors";
import { useTranslation } from "react-i18next";
import { Expression } from "mapbox-gl";
import { useMemo, useState } from "react";
import { LayerPropertyUpdater } from "./GUIStyleEditor";
import {
  buildContinuousRasterColorExpression,
  buildStepExpression,
} from "./visualizationTypes";
import { update } from "lodash";

type StepsConfiguration =
  | "continuous"
  | "manual"
  | keyof RasterBandInfo["stats"];

export type StepsSetting = {
  steps: StepsConfiguration;
  n: number;
};

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
  const [steps, setSteps] = useState<StepsSetting>(
    determineSteps(expression, band, metadata)
  );

  function isDisabled(key: string) {
    return (
      !(key in band.stats) || Object.keys((band.stats as any)[key]).length === 0
    );
  }

  const state = useMemo(() => {
    return determineSteps(expression, band, metadata);
  }, [expression, band, metadata?.["s:steps"]]);

  return (
    <>
      <Editors.Root>
        <Editors.Label title={t("Steps")} />
        <Editors.Control>
          <select
            className="bg-gray-700 rounded text-sm py-1"
            value={state.steps}
            onChange={(e) => {
              if (e.target.value === "continuous") {
                setSteps((prev) => {
                  return {
                    ...prev,
                    steps: "continuous",
                  };
                });
                updateLayerProperty(
                  "paint",
                  "raster-color",
                  buildContinuousRasterColorExpression(
                    undefined,
                    metadata?.["s:palette"] || "schemeGreens6",
                    Boolean(metadata?.["s:reverse-palette"]),
                    [band.minimum, band.maximum]
                  ),
                  {
                    "s:steps": `continuous:${steps.n}`,
                  }
                );
              } else if (e.target.value === "manual") {
              } else {
                let n = steps.n;
                if (!(e.target.value in band.stats)) {
                  throw new Error(`Invalid step type ${e.target.value}`);
                }
                const bucketValues = Object.keys(
                  (band.stats as any)[e.target.value]
                ).map((v) => parseInt(v));
                const max = Math.max(...bucketValues);
                const min = Math.min(...bucketValues);
                if (n > max) {
                  n = max;
                } else if (n < min) {
                  n = min;
                }
                setSteps((prev) => {
                  return {
                    ...prev,
                    steps: e.target.value as StepsConfiguration,
                    n,
                  };
                });
                updateLayerProperty(
                  "paint",
                  "raster-color",
                  buildStepExpression(
                    (band.stats as any)[e.target.value][n],
                    metadata?.["s:palette"] || "schemeGreens6",
                    Boolean(metadata?.["s:reverse-palette"])
                  ),
                  {
                    "s:steps": `${e.target.value}:${n}`,
                  }
                );
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
            {(steps.steps === "manual" || state.steps === "manual") && (
              <option value="manual">{t("Manual")}</option>
            )}
          </select>
        </Editors.Control>
      </Editors.Root>
      {steps.steps !== "continuous" && (
        <Editors.Root>
          <Editors.Label title={t("Number of Steps")} />
          <Editors.Control>
            {steps.steps === "manual" ? (
              <div>{expression.slice(3).length / 2}</div>
            ) : (
              <select
                value={expression.slice(3).length / 2}
                className="bg-gray-700 rounded text-sm py-1"
                onChange={(e) => {
                  const n = parseInt(e.target.value);
                  setSteps((prev) => {
                    return {
                      ...prev,
                      n,
                    };
                  });
                  updateLayerProperty(
                    "paint",
                    "raster-color",
                    buildStepExpression(
                      (band.stats as any)[steps.steps][n],
                      metadata?.["s:palette"] || "schemeGreens6",
                      Boolean(metadata?.["s:reverse-palette"])
                    ),
                    {
                      "s:steps": `${steps.steps}:${n}`,
                    }
                  );
                }}
              >
                {Object.keys((band.stats as any)[steps.steps]).map((key) => (
                  <option key={key} value={key}>
                    {parseInt(key)}
                  </option>
                ))}
              </select>
            )}
          </Editors.Control>
        </Editors.Root>
      )}
    </>
  );
}

export function determineSteps(
  expression: Expression,
  band: RasterBandInfo,
  metadata?: Editors.SeaSketchLayerMetadata
) {
  const result: StepsSetting = {
    steps: "manual",
    n: 6,
  };
  const fnName = expression[0];
  if (/interpolate/.test(fnName)) {
    result.steps = "continuous";
  } else if (fnName === "step") {
    // TODO: look for type in metadata
    const msteps = metadata?.["s:steps"];
    // If present, validate values against expression and band stats
    if (msteps) {
      const [type, n] = msteps.split(":");
      if (type !== "manual" && type !== "continuous" && !(type in band.stats)) {
        throw new Error(`Invalid step type ${type}`);
      }
      result.steps = type as StepsConfiguration;
      result.n = parseInt(n);
      // validate actual expression
      if (!(type in band.stats)) {
        result.steps = "manual";
        return result;
      }
      const buckets = (band.stats as any)[type][n];
      if (!buckets) {
        result.steps = "manual";
        return result;
      }
      const stops = expression.slice(3);
      for (let i = 0; i < stops.length; i += 2) {
        if (!buckets.find((b: Bucket) => b[0] === stops[i])) {
          result.steps = "manual";
          return result;
        }
      }
    } else {
      result.steps = "manual";
    }
  } else {
    result.steps = "manual";
  }
  return result as StepsSetting;
}
