import { RasterBandInfo } from "@seasketch/geostats-types";
import { Expression } from "mapbox-gl";
import { Trans } from "react-i18next";
import { ExpressionEvaluator } from "../../../dataLayers/legends/ExpressionEvaluator";
import { useMemo } from "react";
import * as Slider from "@radix-ui/react-slider";

const tooltipNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export default function ContinuousRasterHistogram({
  band,
  expression,
  range,
  onRangeChange,
}: {
  band: RasterBandInfo;
  expression: Expression;
  range: [number, number];
  onRangeChange: (range: [number, number]) => void;
}) {
  const evaluator = useMemo(() => {
    const expr = [
      expression[0], // fn name
      expression[1], // interpolation type
      ["get", "raster-value"],
      ...expression.slice(3),
    ] as Expression;
    return ExpressionEvaluator.parse(expr, "color");
  }, [expression]);

  const max = band.stats.histogram.reduce((max, count) => {
    // @ts-ignore
    return typeof count[1] === "number" && count[1] > max ? count[1] : max;
  }, 0);

  const value = useMemo(() => {
    return [
      findClosestIndex(
        band.stats.histogram.map((v) => v[0]),
        range[0]
      ),
      findClosestIndex(
        band.stats.histogram.map((v) => v[0]),
        range[1]
      ) + 1,
    ];
  }, [band.stats.histogram, range]);

  if (!band.stats.histogram.length) {
    return null;
  }

  return (
    <div className="leading-8">
      <h4>
        <Trans ns="admin:data">Histogram</Trans>
      </h4>
      <div className="relative my-1 border border-gray-500 border-opacity-50 rounded w-full h-32 flex items-end p-4 pb-5 bg-black bg-opacity-10">
        {band.stats.histogram.map((count, i) => (
          <div
            key={i}
            className="w-2.5 bg-gray-200 flex items-end"
            style={{
              height: `${count[1] ? Math.max((count[1] / max) * 100, 1) : 1}%`,
              backgroundColor: evaluator
                .evaluate({
                  type: "Feature",
                  properties: {
                    "raster-value": count[0],
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
                            "raster-value": count[0],
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
                            "raster-value": count[0],
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
                  "raster-value": Infinity,
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
      <div className="">
        <Slider.Root
          className="-mt-9 relative w-full flex items-center select-none touch-none h-5"
          value={value}
          min={0}
          max={50}
          step={1}
          style={{ width: 426, marginLeft: 13 }}
          minStepsBetweenThumbs={2}
          onValueChange={(value) => {
            const range = [
              band.stats.histogram[value[0]][0],
              band.stats.histogram[value[1] - 1][0],
            ];
            onRangeChange(range as [number, number]);
          }}
        >
          <Slider.Track className=" relative w-full">
            <Slider.Range />
          </Slider.Track>
          <Thumb value={band.stats.histogram[value[0]][0]} />
          <Thumb value={band.stats.histogram[value[1] - 1][0]} />
        </Slider.Root>
      </div>
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
      <div className="opacity-0 group-hover:opacity-100 absolute top-5 bg-gray-800 border border-gray-500 bg-opacity-70 text-green-300 px-1 py-0 text-xs rounded-lg font-mono transition-opacity">
        {tooltipNumberFormatter.format(value)}
      </div>
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
