export function compareResults(
  results: { [key: string]: number },
  expected: { [key: string]: number },
  acceptableDifferenceRatio: number,
  particularDifferenceRatios?: { [key: string]: number },
  log?: boolean
) {
  if (log) {
    for (const classKey in expected) {
      const sqKm = expected[classKey];
      const actual = results[classKey] || 0;
      console.log(
        `${classKey} differed by ${actual > sqKm ? "+" : ""}${
          actual - sqKm === 0
            ? 0
            : Math.round(((actual - sqKm) / sqKm) * 1000) / 10
        }%`
      );
    }
  }
  for (const classKey in expected) {
    const sqKm = expected[classKey];
    const actual = results[classKey] || 0;
    const particularDifferenceRatio =
      particularDifferenceRatios?.[classKey] || acceptableDifferenceRatio;
    const upperBound = sqKm * (1 + particularDifferenceRatio);
    const lowerBound = sqKm * (1 - particularDifferenceRatio);

    if (actual === sqKm) {
      continue;
    }
    // Use try-catch to provide context when assertions fail
    try {
      expect(actual).toBeLessThan(upperBound);
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `[${classKey}] ${originalMessage}\n` +
          `  Expected: ${sqKm} sqKm\n` +
          `  Actual: ${actual} sqKm\n` +
          `  Upper bound: ${upperBound} sqKm (tolerance: ${
            particularDifferenceRatio * 100
          }%)`
      );
    }

    try {
      expect(actual).toBeGreaterThan(lowerBound);
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `[${classKey}] ${originalMessage}\n` +
          `  Expected: ${sqKm} sqKm\n` +
          `  Actual: ${actual} sqKm\n` +
          `  Lower bound: ${lowerBound} sqKm (tolerance: ${
            particularDifferenceRatio * 100
          }%)`
      );
    }
  }
}
