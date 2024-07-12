import {
  Bucket,
  NumericGeostatsAttribute,
  RasterBandInfo,
} from "@seasketch/geostats-types";
import * as Editors from "./Editors";
import { useTranslation } from "react-i18next";
import { Expression } from "mapbox-gl";
import { useMemo, useState } from "react";
import { LayerPropertyUpdater } from "./GUIStyleEditor";
import {
  buildContinuousColorExpression,
  buildStepExpression,
} from "./visualizationTypes";
import { ChevronDownIcon } from "@radix-ui/react-icons";

type StepsConfiguration =
  | "continuous"
  | "manual"
  | keyof RasterBandInfo["stats"]
  | keyof NumericGeostatsAttribute["stats"];

export type StepsSetting = {
  steps: StepsConfiguration;
  n: number;
};

export default function ContinuousStepsEditor({
  stats,
  expression,
  metadata,
  updateLayerProperty,
  minimum,
  maximum,
  valueExpression,
}: {
  stats: RasterBandInfo["stats"] | NumericGeostatsAttribute["stats"];
  expression: Expression;
  metadata?: Editors.SeaSketchLayerMetadata;
  updateLayerProperty: LayerPropertyUpdater;
  minimum: number;
  maximum: number;
  valueExpression: Expression;
}) {
  const { t } = useTranslation("admin:data");
  const [steps, setSteps] = useState<StepsSetting>(
    determineSteps(expression, stats, metadata)
  );

  function isDisabled(key: string) {
    return !(key in stats) || Object.keys((stats as any)[key]).length === 0;
  }

  const state = useMemo(() => {
    return determineSteps(expression, stats, metadata);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, stats, metadata?.["s:steps"]]);

  const Select = Editors.Select;
  return (
    <>
      <Editors.Root>
        <Editors.Label title={t("Steps")} />
        <Editors.Control>
          <Select.Root
            value={state.steps}
            onValueChange={(value) => {
              if (value === "continuous") {
                setSteps((prev) => {
                  return {
                    ...prev,
                    steps: "continuous",
                  };
                });
                updateLayerProperty(
                  "paint",
                  "raster-color",
                  buildContinuousColorExpression(
                    undefined,
                    metadata?.["s:palette"] || "interpolatePlasma",
                    Boolean(metadata?.["s:reverse-palette"]),
                    [minimum, maximum],
                    valueExpression
                  ),
                  {
                    "s:steps": `continuous:${steps.n}`,
                    "s:palette": metadata?.["s:palette"] || "interpolatePlasma",
                  }
                );
              } else if (value === "manual") {
              } else {
                let n = steps.n;
                if (!(value in stats)) {
                  throw new Error(`Invalid step type ${value}`);
                }
                const bucketValues = Object.keys((stats as any)[value]).map(
                  (v) => parseInt(v)
                );
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
                    steps: value as StepsConfiguration,
                    n,
                  };
                });
                updateLayerProperty(
                  "paint",
                  "raster-color",
                  buildStepExpression(
                    (stats as any)[value][n],
                    metadata?.["s:palette"] || "interpolatePlasma",
                    Boolean(metadata?.["s:reverse-palette"]),
                    valueExpression
                  ),
                  {
                    "s:steps": `${value}:${n}`,
                    "s:palette": metadata?.["s:palette"] || "interpolatePlasma",
                  }
                );
              }
            }}
          >
            <Select.Trigger aria-label="Steps">
              <Select.Value placeholder="Continuous" />
              <Select.Icon className="text-gray-300">
                <ChevronDownIcon
                  className="w-4 h-4"
                  style={{ stroke: "none" }}
                />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content>
                <Select.Viewport>
                  <Select.Item value="continuous">
                    <Select.ItemText>{t("Continuous")}</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    disabled={isDisabled("naturalBreaks")}
                    value="naturalBreaks"
                  >
                    <Select.ItemText>{t("Natural Breaks")}</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    disabled={isDisabled("equalInterval")}
                    value="equalInterval"
                  >
                    <Select.ItemText>{t("Equal Interval")}</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    disabled={isDisabled("quantiles")}
                    value="quantiles"
                  >
                    <Select.ItemText>{t("Quantiles")}</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    disabled={isDisabled("standardDeviations")}
                    value="standardDeviations"
                  >
                    <Select.ItemText>{t("Standard Deviation")}</Select.ItemText>
                  </Select.Item>
                  <Select.Item
                    disabled={isDisabled("geometric")}
                    value="geometric"
                  >
                    <Select.ItemText>{t("Geometric")}</Select.ItemText>
                  </Select.Item>
                  {(steps.steps === "manual" || state.steps === "manual") && (
                    <Select.Item value="manual">
                      <Select.ItemText>{t("Manual")}</Select.ItemText>
                    </Select.Item>
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </Editors.Control>
      </Editors.Root>
      {steps.steps !== "continuous" && (
        <Editors.Root>
          <Editors.Label title={t("Number of Steps")} />
          <Editors.Control>
            {steps.steps === "manual" ? (
              <div>{expression.slice(3).length / 2}</div>
            ) : (
              <Select.Root
                value={(expression.slice(3).length / 2).toString()}
                onValueChange={(value) => {
                  const n = parseInt(value);
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
                      (stats as any)[steps.steps][n],
                      metadata?.["s:palette"] || "interpolatePlasma",
                      Boolean(metadata?.["s:reverse-palette"]),
                      valueExpression
                    ),
                    {
                      "s:steps": `${steps.steps}:${n}`,
                      "s:palette":
                        metadata?.["s:palette"] || "interpolatePlasma",
                    }
                  );
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select a number" />
                  <Select.Icon className="text-gray-300">
                    <ChevronDownIcon
                      className="w-4 h-4"
                      style={{ stroke: "none" }}
                    />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content>
                    <Select.Viewport>
                      {Object.keys((stats as any)[steps.steps]).map((key) => (
                        <Select.Item key={key} value={key} className="px-5">
                          <Select.ItemText>{parseInt(key)}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            )}
          </Editors.Control>
        </Editors.Root>
      )}
    </>
  );
}

export function determineSteps(
  expression: Expression,
  stats: RasterBandInfo["stats"] | NumericGeostatsAttribute["stats"],
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
    const msteps = metadata?.["s:steps"];
    // If present, validate values against expression and band stats
    if (msteps) {
      const [type, n] = msteps.split(":");
      if (type !== "manual" && type !== "continuous" && !(type in stats)) {
        throw new Error(`Invalid step type ${type}`);
      }
      result.steps = type as StepsConfiguration;
      result.n = parseInt(n);
      // validate actual expression
      if (!(type in stats)) {
        result.steps = "manual";
        return result;
      }
      const buckets = (stats as any)[type][n];
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
