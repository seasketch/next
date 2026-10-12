import { expectedHitMatches, expectedRoutes } from "./frame";

describe("ocean-bitmap expected routes", () => {
  it("loads a hit list for every sketch", () => {
    expect(expectedRoutes.tolerance).toBe(0.1);
    expect(expectedRoutes.cellSizeDegrees).toBe(0.005);
    expect(Object.keys(expectedRoutes.cases)).toHaveLength(18);
    for (const hits of Object.values(expectedRoutes.cases)) {
      expect(hits.length).toBeGreaterThan(0);
      for (const hit of hits) {
        expect(hit.port.length).toBeGreaterThan(0);
        expect(hit.km).toBeGreaterThan(0);
      }
    }
  });

  it("accepts the same port within 10 percent and rejects a different port or order", () => {
    const expected = expectedRoutes.cases["gull-island"]![0]!;
    expect(expectedHitMatches(expected, expected.port, expected.km)).toBe(true);
    expect(expectedHitMatches(expected, expected.port, expected.km * 1.1)).toBe(true);
    expect(expectedHitMatches(expected, expected.port, expected.km * 1.11)).toBe(false);
    expect(expectedHitMatches(expected, "SOMEWHERE ELSE", expected.km)).toBe(false);
    expect(expectedHitMatches(undefined, expected.port, expected.km)).toBe(false);
  });
});
