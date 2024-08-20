import { Bucket, RasterBandInfo } from "@seasketch/geostats-types";
import { Expression } from "mapbox-gl";
import { Trans, useTranslation } from "react-i18next";
import { ExpressionEvaluator } from "../../../dataLayers/legends/ExpressionEvaluator";
import { memo, useEffect, useMemo, useState } from "react";
import * as Slider from "@radix-ui/react-slider";

export default memo(function HistogramControl({
  histogram,
  expression,
  range,
  onRangeChange,
  excludeOutsideRange,
}: {
  histogram: Bucket[];
  expression: Expression;
  range: [number, number];
  onRangeChange: (
    range: [number, number],
    excludeOutsideRange: boolean
  ) => void;
  excludeOutsideRange?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const evaluator = useMemo(() => {
    const fnType = expression[0];
    let expr: Expression = /interpolate/.test(fnType)
      ? [
          expression[0], // fn name
          expression[1], // interpolation type
          ["get", "value"],
          ...(excludeOutsideRange
            ? expression.slice(5, expression.length - 2)
            : expression.slice(3)),
        ]
      : [
          expression[0], // fn name
          ["get", "value"],
          ...expression.slice(2),
        ];
    return ExpressionEvaluator.parse(expr, "color");
  }, [expression, excludeOutsideRange]);

  const max = histogram.reduce((max, count) => {
    // @ts-ignore
    return typeof count[1] === "number" && count[1] > max ? count[1] : max;
  }, 0);

  const value = useMemo(() => {
    return [
      findClosestIndex(
        histogram.map((v) => v[0]),
        range[0]
      ),
      findClosestIndex(
        histogram.map((v) => v[0]),
        range[1]
      ) + 1,
    ];
  }, [histogram, range]);

  if (!histogram.length) {
    return null;
  }

  return (
    <div className="leading-8 relative">
      <h4>
        <Trans ns="admin:data">Histogram</Trans>
      </h4>
      <div
        className={`relative my-1 border border-gray-500 border-opacity-50 rounded w-full bg-black bg-opacity-10 ${
          /interpolate/.test(expression[0]) ? "h-40" : "h-32"
        } flex flex-col`}
      >
        <div className="h-32 w-full flex items-end p-4 pb-5">
          {histogram.map((count, i) => (
            <div
              key={i}
              className="w-2.5 bg-gray-200 flex items-end"
              style={{
                height: `${
                  count[1] ? Math.max((count[1] / max) * 100, 1) : 1
                }%`,
                backgroundColor: evaluator
                  .evaluate({
                    type: "Feature",
                    properties: {
                      value: count[0],
                    },
                    geometry: {
                      type: "Point",
                      coordinates: [0, 0],
                    },
                  })
                  .toString(),
              }}
            >
              <div
                className="w-0.5 border-l border-white border-opacity-20"
                style={
                  i % 10 === 0
                    ? {
                        borderColor: evaluator
                          .evaluate({
                            type: "Feature",
                            properties: {
                              value: count[0],
                            },
                            geometry: {
                              type: "Point",
                              coordinates: [0, 0],
                            },
                          })
                          .toString(),
                        marginBottom: -10,
                        height: 10,
                      }
                    : {
                        borderColor: evaluator
                          .evaluate({
                            type: "Feature",
                            properties: {
                              value: count[0],
                            },
                            geometry: {
                              type: "Point",
                              coordinates: [0, 0],
                            },
                          })
                          .toString(),
                        marginBottom: -5,
                        height: 5,
                      }
                }
              ></div>
            </div>
          ))}
          <div
            className="w-0.5 border-l  border-opacity-20"
            style={{
              marginBottom: -10,
              height: 10,
              borderColor: evaluator
                .evaluate({
                  type: "Feature",
                  properties: {
                    value: Infinity,
                  },
                  geometry: {
                    type: "Point",
                    coordinates: [0, 0],
                  },
                })
                .toString(),
            }}
          ></div>
        </div>
        {/interpolate/.test(expression[0]) && (
          <>
            <Slider.Root
              className="absolute top-24 -left-0.5 w-full flex items-center select-none touch-none h-5"
              value={value}
              min={0}
              max={50}
              step={1}
              style={{ width: 426, marginLeft: 13 }}
              minStepsBetweenThumbs={2}
              onValueChange={(value) => {
                const range = [
                  histogram[value[0]][0],
                  histogram[value[1] - 1][0],
                ];
                onRangeChange(
                  range as [number, number],
                  Boolean(excludeOutsideRange)
                );
              }}
            >
              <Slider.Track className=" relative w-full">
                <Slider.Range />
              </Slider.Track>
              <Thumb value={histogram[value[0]][0]} />
              <Thumb value={histogram[value[1] - 1][0]} />
            </Slider.Root>
            <div className="flex-1 flex items-center justify-start bg-gray-800 rounded-b text-gray-300">
              <RangeNumberInput
                label={t("Min")}
                max={range[1]}
                value={range[0]}
                onChange={(value) =>
                  onRangeChange([value, range[1]], Boolean(excludeOutsideRange))
                }
              />
              <RangeNumberInput
                min={range[0]}
                label={t("Max")}
                value={range[1]}
                onChange={(value) =>
                  onRangeChange([range[0], value], Boolean(excludeOutsideRange))
                }
              />
              <div className="space-x-2 flex items-center pl-2">
                <label className="text-xs" htmlFor="excludeOutsideRange">
                  {t("Show values outside range")}
                </label>
                <input
                  id="excludeOutsideRange"
                  className="rounded bg-gray-500"
                  type="checkbox"
                  checked={!excludeOutsideRange}
                  onChange={(e) => {
                    onRangeChange(range, !e.target.checked);
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

function RangeNumberInput({
  onChange,
  value,
  label,
  min,
  max,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const [state, setState] = useState(value.toString());

  useEffect(() => {
    setState(value.toString());
  }, [value]);

  return (
    <div className="flex items-center space-x-2 text-xs p-1 pl-3">
      <label>{label}</label>
      <input
        min={min}
        max={max}
        className="w-20 text-xs py-0.5 bg-gray-700 border-none bg-opacity-30 text-green-300 font-mono rounded-sm"
        type="number"
        value={state}
        onChange={(e) => {
          setState(e.target.value);
          const number = parseFloat(e.target.value);
          if (e.target.value.trim() !== "") {
            if (min === undefined || number >= min) {
              if (max === undefined || number <= max) {
                onChange(number);
              }
            }
          }
        }}
      />
    </div>
  );
}

function Thumb({ value }: { value: number }) {
  return (
    <Slider.Thumb
      className="group w-2 h-4 rounded-sm bg-gray-300 cursor-grab active:cursor-grabbing flex items-center justify-center"
      style={{
        boxShadow: "1px 1px 2px rgba(0,0,0,0.8)",
      }}
    >
      <div
        className="h-2.5 bg-black opacity-40 rounded"
        style={{ width: 1, left: "50%" }}
      ></div>
      {/* <div className="opacity-0 group-hover:opacity-100 absolute top-5 bg-gray-800 border border-gray-500 bg-opacity-70 text-green-300 px-1 py-0 text-xs rounded-lg font-mono transition-opacity pointer-events-none">
        {tooltipNumberFormatter.format(value)}
      </div> */}
    </Slider.Thumb>
  );
}

function findClosestIndex(arr: number[], target: number): number {
  // Initialize variables to store the closest index and the smallest difference
  let closestIndex = -1;
  let smallestDifference = Infinity;

  // Loop through the array to find the closest number
  for (let i = 0; i < arr.length; i++) {
    // Calculate the absolute difference between the target and the current element
    const difference = Math.abs(arr[i] - target);

    // If the current difference is smaller than the smallest difference found so far,
    // update the closest index and the smallest difference
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestIndex = i;
    }
  }

  // Return the index of the closest number
  return closestIndex;
}
