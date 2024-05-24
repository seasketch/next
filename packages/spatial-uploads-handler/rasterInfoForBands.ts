import gdal from "gdal-async";
import {
  equalIntervalBuckets,
  geometricIntervalBuckets,
  naturalBreaksBuckets,
  quantileBuckets,
  stdDevBuckets,
} from "./src/stats";
import {
  Bucket,
  RasterBandInfo,
  RasterBucket,
  RasterBuckets,
  RasterInfo,
  SuggestedRasterPresentation,
} from "@seasketch/geostats-types";

/**
 * Given the path to a raster file, this function will calculate metadata useful
 * for data handling and cartography.
 *
 * @param filepath
 * @returns A promise that resolves to a RasterInfo object
 */
export async function rasterInfoForBands(
  filepath: string
): Promise<RasterInfo> {
  const dataset = await gdal.openAsync(filepath);
  const info = {
    bands: [] as RasterBandInfo[],
    metadata: dataset.getMetadata(),
    presentation: SuggestedRasterPresentation.rgb,
  };
  const categories: { [key: number]: number } = {};
  let categoryCount = 0;
  dataset.bands.forEach((band) => {
    const dataType = band.dataType;
    const stats = band.getStatistics(false, true) as {
      min: number | null;
      max: number | null;
      mean: number;
      std_dev: number;
    };
    const metadata = band.getMetadata();
    const size = band.size;
    const noDataValue = band.noDataValue;
    if (noDataValue !== null) {
      if (noDataValue === stats.min) {
        stats.min = null;
      }
      if (noDataValue === stats.max) {
        stats.max = null;
      }
    }
    // band.histogram()
    let count = band.size.x * band.size.y;
    let sampledCount = 0;
    const sampledPixelValues: number[] = [];
    const samplingInterval = Math.max(1, Math.floor(count / 500_000));
    let num = 0;
    let sum = 0;
    // TODO: Can this be sped up by reading a block at a time?
    for (var y = 0; y < size.y; y++) {
      const values = band.pixels.read(0, y, size.x, 1);
      for (var i = 0; i < size.x; i++) {
        const value = values[i];
        if (value !== noDataValue) {
          if (stats.min === null || value < stats.min) {
            stats.min = value;
          }
          if (stats.max === null || value > stats.max) {
            stats.max = value;
          }
          sum += value;
          num++;
          if (num % samplingInterval === 0) {
            sampledPixelValues.push(value);
            sampledCount++;
            if (categories[value]) {
              categories[value]++;
            } else if (categoryCount < 256) {
              categories[value] = 1;
              categoryCount++;
            }
          }
        }
      }
    }
    if (sampledPixelValues.indexOf(stats.min!) === -1) {
      sampledPixelValues.push(stats.min!);
    }
    if (sampledPixelValues.indexOf(stats.max!) === -1) {
      sampledPixelValues.push(stats.max!);
    }
    stats.mean = sum / num;
    sampledPixelValues.sort((a, b) => a - b);
    const b: RasterBandInfo = {
      name:
        metadata.standard_name ||
        metadata.long_name ||
        metadata.units ||
        `band ${band.id}`,
      metadata,
      colorInterpretation: band.colorInterpretation || null,
      minimum: stats.min!,
      stats: {
        mean: stats.mean,
        stdev: stats.std_dev,
        equalInterval: {},
        naturalBreaks: {},
        quantiles: {},
        standardDeviations: {},
        geometricInterval: {},
        histogram: equalIntervalBuckets(
          sampledPixelValues,
          49,
          stats.max!,
          true
        ),
        categories: Object.keys(categories)
          .reduce((acc, key) => {
            acc.push([
              parseInt(key),
              categories[/\./.test(key) ? parseFloat(key) : parseInt(key)] /
                sampledCount,
            ]);
            return acc;
          }, [] as RasterBucket[])
          .sort((a, b) => a[0] - b[0]),
      },
      maximum: stats.max!,
      noDataValue: band.noDataValue as number | null,
      offset: band.offset,
      scale: band.scale,
      count,
      base:
        dataType === "Byte"
          ? 0
          : dataType === "Int16"
          ? -32768
          : dataType === "UInt16"
          ? 0
          : dataType === "Int32"
          ? -2147483648
          : 0,
    };
    const numBreaks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    for (const n of numBreaks) {
      addBuckets(
        b.stats.equalInterval,
        n,
        equalIntervalBuckets(sampledPixelValues, n, b.maximum, true)
      );
      addBuckets(
        b.stats.geometricInterval,
        n,
        geometricIntervalBuckets(
          sampledPixelValues,
          n,
          b.minimum,
          b.maximum,
          true
        )
      );
      addBuckets(
        b.stats.quantiles,
        n,
        quantileBuckets(sampledPixelValues, n, b.minimum, b.maximum, true, true)
      );
      addBuckets(
        b.stats.naturalBreaks,
        n,
        naturalBreaksBuckets(
          sampledPixelValues,
          n,
          b.stats.histogram.length,
          b.minimum,
          b.maximum,
          10000,
          true
        )
      );
      addBuckets(
        b.stats.standardDeviations,
        n,
        stdDevBuckets(
          sampledPixelValues,
          n,
          b.stats.mean,
          b.stats.stdev,
          b.minimum,
          b.maximum,
          true
        )
      );
    }
    if (b.colorInterpretation === "Palette") {
      const colorTable = band.colorTable;
      if (colorTable) {
        b.colorTable = [];
        for (var i = 0; i < colorTable.count(); i++) {
          const entry = colorTable.get(i);
          if (entry && b.stats.categories.find((c) => c[0] === i)) {
            b.colorTable.push([
              i,
              entry.c4 !== undefined && entry.c4 !== 255
                ? `rgba(${entry.c1},${entry.c2},${entry.c3},${entry.c4})`
                : `rgb(${entry.c1},${entry.c2},${entry.c3})`,
            ]);
          }
        }
        b.colorTable.sort((a, b) => a[0] - b[0]);
      }
    }
    info.bands.push(b);
  });

  if (info.bands[0].colorInterpretation === "Palette") {
    info.presentation = SuggestedRasterPresentation.categorical;
  } else if (info.bands[0].stats.categories.length < 12) {
    info.presentation = SuggestedRasterPresentation.categorical;
  } else if (info.bands[0].colorInterpretation === "Gray") {
    info.presentation = SuggestedRasterPresentation.continuous;
  }
  return info;
}

function addBuckets(
  subject: RasterBuckets,
  numBuckets: number,
  value?: Bucket[] | null
) {
  if (value) {
    subject[numBuckets] = value;
  }
}
