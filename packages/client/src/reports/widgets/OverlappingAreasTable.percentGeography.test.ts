import { resolveOverlappingAreasPercentGeographyId } from "./overlappingAreasPercentGeography";

describe("resolveOverlappingAreasPercentGeographyId", () => {
  const primaryId = 42;

  test("null hides the column (new-widget default)", () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { percentGeographyId: null },
        primaryId
      )
    ).toBeUndefined();
  });

  test('"primary" resolves to the clipping geography', () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { percentGeographyId: "primary" },
        primaryId
      )
    ).toBe(primaryId);
  });

  test("numeric id is used as-is", () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { percentGeographyId: 99 },
        primaryId
      )
    ).toBe(99);
  });

  test("legacy showPercentColumn false hides the column", () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { showPercentColumn: false },
        primaryId
      )
    ).toBeUndefined();
  });

  test("legacy empty settings default to primary (column on)", () => {
    expect(resolveOverlappingAreasPercentGeographyId({}, primaryId)).toBe(
      primaryId
    );
  });

  test("legacy showPercentColumn true uses primary", () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { showPercentColumn: true },
        primaryId
      )
    ).toBe(primaryId);
  });

  test("explicit percentGeographyId wins over legacy boolean", () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { percentGeographyId: 7, showPercentColumn: false },
        primaryId
      )
    ).toBe(7);
  });
});
