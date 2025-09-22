import { ckmeans, equalIntervalBreaks, quantile } from "simple-statistics";
import { Bucket } from "@seasketch/geostats-types";

export function equalIntervalBuckets(
  data: number[],
  numBuckets: number,
  max?: number,
  fraction = false
) {
  const breaks = equalIntervalBreaks(data, numBuckets);
  breaks.pop();

  max = max !== undefined ? max : Math.max(...data);

  return breaksToBuckets(max, breaks, data, fraction);
}

export function quantileBuckets(
  data: number[],
  numBuckets: number,
  min?: number,
  max?: number,
  fraction = false,
  includeDuplicates = false
) {
  if (data.length <= numBuckets) {
    return null;
  }
  min = min !== undefined ? min : Math.min(...data);
  max = max !== undefined ? max : Math.max(...data);
  const quants = getQuantiles(data, numBuckets, includeDuplicates);
  if (quants) {
    const breaks = [min, ...quants];
    return breaksToBuckets(max, breaks, data, fraction);
  }
}

export function stdDevBuckets(
  data: number[],
  numBuckets: number,
  mean: number,
  stdDev: number,
  min?: number,
  max?: number,
  fraction = false
) {
  min = min !== undefined ? min : Math.min(...data);
  max = max !== undefined ? max : Math.max(...data);
  const breaks = getStdDevBreaks(numBuckets, min, max, mean, stdDev);
  if (breaks) {
    return breaksToBuckets(max, breaks, data, fraction);
  }
}

export function naturalBreaksBuckets(
  data: number[],
  numBuckets: number,
  /** Number of unique values in data */
  uniqueCount: number,
  min?: number,
  max?: number,
  downsampleTo?: number,
  fraction = false
) {
  min = min !== undefined ? min : Math.min(...data);
  max = max !== undefined ? max : Math.max(...data);
  // first check that data contains more than one unique value
  if (uniqueCount <= numBuckets) {
    return null;
  }
  let downsampled = data;
  if (downsampleTo) {
    downsampled = downsampleArray(data, downsampleTo);
  }
  const clusters = ckmeans(downsampled, numBuckets);
  let breaks: number[] = [];
  for (var i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    const max = Math.max(...cluster);
    // if (i > 0) {
    breaks.push(max);
    // }
  }
  breaks.pop();
  if (breaks[0] !== min) {
    breaks.unshift(min!);
  }
  if (breaks.length < numBuckets) {
    // Find the first cluster that has more than one value, which
    // aren't represented in the breaks.
    for (var i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const max = Math.max(...cluster);
      const min = Math.min(...cluster);
      if (max > min) {
        if (breaks.indexOf(min) === -1) {
          // Find the index of max, and insert it before that in the
          // breaks
          const idx = breaks.indexOf(max);
          if (idx === -1) {
            breaks.push(min);
          } else {
            breaks.splice(idx, 0, min);
          }
        }
      }
      if (breaks.length >= numBuckets) {
        break;
      }
    }
  }
  return breaksToBuckets(max, breaks, fraction ? downsampled : data, fraction);
}

export function geometricIntervalBuckets(
  data: number[],
  numBuckets: number,
  min?: number,
  max?: number,
  fraction = false
) {
  min = min !== undefined ? min : Math.min(...data);
  max = max !== undefined ? max : Math.max(...data);
  const logMax: number = Math.log(max) / Math.LN10;
  let logMin: number = Math.log(min) / Math.LN10;
  if (logMin < 0) {
    logMin = 0;
  }
  const interval: number = (logMax - logMin) / numBuckets;
  const initialBuckets: Array<number> = [];
  for (let idx = 0; idx < numBuckets; idx++) {
    idx === 0
      ? (initialBuckets[idx] = logMin)
      : (initialBuckets[idx] = initialBuckets[idx - 1] + interval);
  }
  const breaks: Array<number> = initialBuckets.map((el) =>
    el === 0 ? 0 : Math.pow(10, el)
  );
  return breaksToBuckets(max, breaks, data, fraction);
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

function getQuantiles(
  population: number[],
  numBuckets: number,
  includeDuplicates = false
) {
  // use simple-statistics quantile() function to get quantiles for numBuckets
  const quantiles = [];
  for (let i = 1; i < numBuckets; i++) {
    quantiles.push(quantile(population, i / numBuckets));
    if (
      quantiles.length >= 2 &&
      quantiles[quantiles.length - 1] === quantiles[quantiles.length - 2] &&
      !includeDuplicates
    ) {
      // Too many duplicate values, return null
      return null;
    }
  }
  return quantiles;
}

function getStdDevBreaks(
  numBins: number,
  min: number,
  max: number,
  mean: number,
  stdDev: number
) {
  const breaks = [mean + stdDev / 2];
  // First, work backwards towards min. Keep adding breaks until within two
  // standard deviations of min. This 1.9 multiplier is somewhat arbitrary. It
  // prevents the addition of a break that would be too close to the min value.
  while (breaks[0] - stdDev * 1.9 > min) {
    breaks.unshift(breaks[0] - stdDev);
  }
  if (breaks[0] !== min) {
    breaks.unshift(min);
  }

  // Then work forwards towards max
  while (breaks.length < numBins && breaks[breaks.length - 1] + stdDev < max) {
    breaks.push(breaks[breaks.length - 1] + stdDev);
  }
  if (breaks.length < numBins) {
    return null;
  }
  return breaks;
}

function downsampleArray(data: number[], targetSize: number) {
  const dataSize = data.length;
  if (dataSize <= targetSize) {
    return data; // No need to downsample if data is already smaller or equal to target size
  }

  const step = Math.floor(dataSize / targetSize);
  const sampledData = [data[0]];

  for (let i = 1; i < dataSize; i += step) {
    sampledData.push(data[i]);
  }

  // Ensure the last element is included if not already
  sampledData.push(data[dataSize - 1]);

  return sampledData;
}

// Function to convert RGB to a single number
function rgbToNumber(r: number, g: number, b: number): number {
  return (r << 16) + (g << 8) + b;
}

// Function to convert a single number to RGB
function numberToRGB(num: number): [number, number, number] {
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return [r, g, b];
}

export function getRepresentativeColors(
  pixels: number[][],
  numColors: number,
  downsampleTo?: number
): [number, number, number][] {
  let flattenedPixels = pixels.map((pixel) =>
    rgbToNumber(pixel[0], pixel[1], pixel[2])
  );
  flattenedPixels.sort((a, b) => a - b);
  if (downsampleTo) {
    flattenedPixels = downsampleArray(flattenedPixels, downsampleTo);
  }

  const clusters = ckmeans(flattenedPixels, numColors);
  const colors = clusters.map((cluster, i) => {
    const pixels = cluster.map((num) => numberToRGB(num));
    return numberToRGB(cluster[Math.floor(cluster.length / 2)]);
  });
  // sort colors by hue
  colors.sort((a, b) => {
    const aHue = rgbToHue(a[0], a[1], a[2]);
    const bHue = rgbToHue(b[0], b[1], b[2]);
    return aHue - bHue;
  });

  return colors;
}

function rgbToHue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  if (max === r) {
    hue = (g - b) / (max - min);
  } else if (max === g) {
    hue = 2 + (b - r) / (max - min);
  } else {
    hue = 4 + (r - g) / (max - min);
  }
  hue *= 60;
  if (hue < 0) {
    hue += 360;
  }
  return hue;
}
