import * as Papa from "papaparse";
import { createReadStream } from "node:fs";
import * as cliProgress from "cli-progress";
import {
  GeostatsAttribute,
  isNumericGeostatsAttribute,
  NumericGeostatsAttribute,
  Bucket,
} from "@seasketch/geostats-types";
import { countLines } from "./countLines";
import { equalIntervalBreaks } from "simple-statistics";

export default async function generateGeostats(
  filePath: string,
  silent: boolean = false
) {
  let i = 0;
  // console.log("determining row count");
  const totalRows = await countLines(filePath);
  // console.log("row count", totalRows);
  const numericAttributeRunningStats: {
    [key: string]: {
      sum: number;
      m2: number;
      mean: number;
    };
  } = {};
  const attributes: { [key: string]: Partial<GeostatsAttribute> } = {
    id: {
      count: totalRows,
      countDistinct: totalRows,
      type: "string",
      attribute: "id",
    },
  };
  let progressBar: cliProgress.SingleBar;
  if (!silent) {
    progressBar = new cliProgress.SingleBar(
      {
        format:
          "Progress | {bar} | {percentage}% || {value}/{total} rows processed",
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic
    );
    progressBar.start(totalRows, 0);
  }
  const stream = createReadStream(filePath);

  return new Promise<GeostatsAttribute[]>((resolve, reject) => {
    Papa.parse<{ id: string } & any>(stream, {
      header: true,
      dynamicTyping: true,
      step: (row: any, parser) => {
        if (!silent) {
          progressBar.update(i);
        }
        for (const key in row.data) {
          if (key !== "id" && key !== "__parsed_extra") {
            if (!attributes[key]) {
              attributes[key] = {
                count: 0,
                countDistinct: 0,
                attribute: key,
              };
            }
            const value = row.data[key];
            const attribute = attributes[key] as Partial<GeostatsAttribute>;
            if (value !== null) {
              attribute.count!++;
            }
            if (attribute.type === undefined && value !== null) {
              if (typeof value === "number") {
                attribute.type = "number";
              } else if (typeof value === "string") {
                attribute.type = "string";
              } else if (typeof value === "boolean") {
                attribute.type = "boolean";
              } else if (Array.isArray(value)) {
                attribute.type = "array";
              } else if (typeof value === "object") {
                attribute.type = "object";
              } else {
                attribute.type = "mixed";
              }
            }
            if (!attribute.values) {
              attribute.values = {};
            }
            if (!attribute.values[value]) {
              attribute.values[value] = 0;
            }
            if (value in attribute.values) {
              attribute.values[value]++;
            }
            if (attribute.type === "string") {
            } else if (
              attribute.type === "number" &&
              value !== null &&
              attribute.type &&
              isNumericGeostatsAttribute(attribute as GeostatsAttribute)
            ) {
              // collect stats
              if (attribute.min === undefined || value < attribute.min) {
                attribute.min = value;
              }
              if (attribute.max === undefined || value > attribute.max) {
                attribute.max = value;
              }
              if (!(attribute as NumericGeostatsAttribute).stats) {
                (attribute as NumericGeostatsAttribute).stats = {
                  avg: 0,
                  equalInterval: [],
                  naturalBreaks: [],
                  quantiles: [],
                  geometricInterval: [],
                  standardDeviations: [],
                  histogram: [],
                  stdev: 0,
                };
              }
              if (!numericAttributeRunningStats[key]) {
                numericAttributeRunningStats[key] = {
                  sum: 0,
                  m2: 0,
                  mean: 0,
                };
              }
              const runningStats = numericAttributeRunningStats[key];
              runningStats.sum += value;
              const delta = value - runningStats.mean;
              runningStats.mean += delta / attribute.count!;
              const delta2 = value - runningStats.mean;
              runningStats.m2 += delta * delta2;
            }
          }
        }
        i++;
      },
      complete: () => {
        const attributeList = Object.keys(attributes).map((key) => ({
          key,
          ...attributes[key],
        }));
        for (const attribute of attributeList) {
          if (attribute.attribute !== "id") {
            attribute.countDistinct = Object.keys(
              attribute.values || {}
            ).length;
            if (isNumericGeostatsAttribute(attribute as GeostatsAttribute)) {
              const stats = (attribute as NumericGeostatsAttribute).stats;
              stats.avg =
                numericAttributeRunningStats[attribute.key].sum /
                attribute.count!;
              stats.stdev = Math.sqrt(
                numericAttributeRunningStats[attribute.key].m2 /
                  attribute.count!
              );
              const sortedValues = Object.keys(attribute.values!)
                .sort()
                .reduce((acc, v) => {
                  const number = /\./.test(v) ? parseFloat(v) : parseInt(v);
                  const count = attribute.values![v];
                  for (let i = 0; i < count; i++) {
                    acc.push(number);
                  }
                  return acc;
                }, [] as number[]);
              if (attribute.max !== undefined && sortedValues.length > 2) {
                stats.histogram = equalIntervalBuckets(
                  sortedValues,
                  49,
                  attribute.max!
                );
              }
            }
            // limit attribute.values to the first 100 keys
            const limit = isNumericGeostatsAttribute(
              attribute as GeostatsAttribute
            )
              ? 10
              : 50;
            const keys = Object.keys(attribute.values!);
            if (keys.length > limit) {
              const newValues: { [key: string]: number } = {};
              for (let i = 0; i < limit; i++) {
                newValues[keys[i]] = attribute.values![keys[i]];
              }
              attribute.values = newValues;
            }
          }
        }
        if (!silent) {
          progressBar.update(totalRows); // Set it to 100% completion
          progressBar.stop();
        }
        resolve(attributeList as GeostatsAttribute[]);
      },
      error: (err) => {
        reject(err);
      },
    });
  });
}

export function equalIntervalBuckets(
  data: number[],
  numBuckets: number,
  max?: number,
  fraction = false
) {
  const breaks = equalIntervalBreaks(data, numBuckets);
  breaks.pop();

  return breaksToBuckets(max || Math.max(...data), breaks, data, fraction);
}

function breaksToBuckets(
  max: number,
  breaks: number[],
  values: number[],
  fraction = false
) {
  const buckets: Bucket[] = [];
  for (const b of breaks) {
    const nextBreak = breaks[breaks.indexOf(b) + 1];
    const isLastBreak = nextBreak === undefined;
    let valuesInRange = 0;
    for (const value of values) {
      if (value >= b && (isLastBreak || value < nextBreak)) {
        valuesInRange++;
      }
    }
    buckets.push([b, fraction ? valuesInRange / values.length : valuesInRange]);
  }
  buckets.push([max, null]);
  return buckets;
}
