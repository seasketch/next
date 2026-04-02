import {
  GeostatsAttribute,
  GeostatsLayer,
  isNumericGeostatsAttribute,
  NumericGeostatsAttribute,
} from "@seasketch/geostats-types";

export function findBestCategoricalAttribute(geostats: GeostatsLayer) {
  const attributes = geostats.attributes;
  const filtered = categoricalAttributes(attributes);
  // sort the attributes by suitability, with the most suitable coming first.
  // Criteria:
  //   1. Strings are prefered over booleans, booleans over numbers
  //   2. attribute.values contains a count of how many times each value appears in the dataset. Prefer attributes where the sum of these counts is a large proprotion of the total number of features
  //   3. Fewer unique values (countDistinct) are prefered
  const sorted = [...filtered].sort((a, b) => {
    if (a.type === "string" && b.type !== "string") {
      return -1;
    } else if (b.type === "string" && a.type !== "string") {
      return 1;
    }
    if (a.type === "boolean" && b.type !== "boolean") {
      return -1;
    } else if (b.type === "boolean" && a.type !== "boolean") {
      return 1;
    }
    const totalFeaturesWithValuesA = Object.values(a.values).reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalFeaturesWithValuesB = Object.values(b.values).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (totalFeaturesWithValuesA > totalFeaturesWithValuesB) {
      return -1;
    } else if (totalFeaturesWithValuesB > totalFeaturesWithValuesA) {
      return 1;
    }
    const aCountDistinct =
      a.countDistinct && a.countDistinct > 1 ? a.countDistinct : Infinity;
    const bCountDistinct =
      b.countDistinct && b.countDistinct > 1 ? b.countDistinct : Infinity;
    return aCountDistinct - bCountDistinct;
  });

  if (sorted.length) {
    return sorted[0];
  } else {
    return null;
  }
}

export function categoricalAttributes(attributes: GeostatsAttribute[]) {
  return attributes.filter(
    (a) => a.countDistinct && a.countDistinct > 1 && a.type === "string",
    // || a.type === "boolean")
    // CB 7/22/24 disallow strings and booleans for categorical expressions
    //  ||
    // (a.type === "number" && a.countDistinct && a.countDistinct < 12))
  );
}

export function findBestContinuousAttribute(geostats: GeostatsLayer) {
  const attributes = geostats.attributes;
  const filtered = [...attributes].filter(
    (a) =>
      isNumericGeostatsAttribute(a) &&
      a.min !== undefined &&
      a.max !== undefined &&
      a.min < a.max,
  ) as NumericGeostatsAttribute[];
  // first, sort attributes by number of stddev values
  const sorted = filtered
    .sort((a, b) => {
      let aValue = a.stats?.standardDeviations
        ? Object.keys(a.stats?.standardDeviations || {}).length
        : 0;
      let bValue = b.stats?.standardDeviations
        ? Object.keys(b.stats?.standardDeviations || {}).length
        : 0;
      return bValue - aValue;
    })
    .reverse();
  for (const attr of sorted) {
    if (
      !/area/i.test(attr.attribute) &&
      !/length/i.test(attr.attribute) &&
      !/code/i.test(attr.attribute) &&
      Object.keys(attr.stats?.standardDeviations || {}).length > 3
    ) {
      return attr.attribute;
    }
  }
  const best = sorted.find(
    (a) => Object.keys(a.stats?.standardDeviations || {}).length > 3,
  );
  if (best) {
    return best.attribute;
  }
  if (sorted.length) {
    return sorted[0].attribute;
  }
  return null;
}
