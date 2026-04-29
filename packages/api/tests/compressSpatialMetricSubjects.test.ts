import { compressSpatialMetricSubjectsForWire } from "../src/reports/compressSpatialMetricSubjects";

describe("compressSpatialMetricSubjectsForWire", () => {
  test("maps geography subject to g", () => {
    const { metrics, fragmentSubjectCatalog } = compressSpatialMetricSubjectsForWire(
      [
        {
          id: 1,
          subject: { __typename: "GeographySubject", id: 42 },
        },
      ],
    );
    expect(fragmentSubjectCatalog).toEqual([]);
    expect(metrics[0]).toMatchObject({ id: 1, g: 42 });
    expect((metrics[0] as any).subject).toBeUndefined();
    expect((metrics[0] as any).f).toBeUndefined();
  });

  test("dedupes fragment subjects into catalog and assigns f", () => {
    const hash = "a".repeat(64);
    const { metrics, fragmentSubjectCatalog } = compressSpatialMetricSubjectsForWire(
      [
        {
          id: 1,
          subject: {
            __typename: "FragmentSubject",
            hash,
            sketches: [10],
            geographies: [20, 21],
          },
        },
        {
          id: 2,
          subject: {
            __typename: "FragmentSubject",
            hash,
            sketches: [10],
            geographies: [20, 21],
          },
        },
      ],
    );
    expect(fragmentSubjectCatalog).toHaveLength(1);
    expect(fragmentSubjectCatalog[0]).toMatchObject({
      __typename: "FragmentSubject",
      hash,
      sketches: [10],
      geographies: [20, 21],
    });
    expect(metrics[0]).toMatchObject({ id: 1, f: 0 });
    expect(metrics[1]).toMatchObject({ id: 2, f: 0 });
    expect((metrics[0] as any).subject).toBeUndefined();
    expect((metrics[0] as any).g).toBeUndefined();
  });
});
