import { droppedJoinInfoFromColumnStats } from "./droppedJoinInfo";

describe("droppedJoinInfoFromColumnStats", () => {
  it("returns empty values for null and undefined", () => {
    expect(droppedJoinInfoFromColumnStats(null)).toEqual({
      droppedJoinValues: [],
    });
    expect(droppedJoinInfoFromColumnStats(undefined)).toEqual({
      droppedJoinValues: [],
    });
  });

  it("returns empty values for non-objects", () => {
    expect(droppedJoinInfoFromColumnStats("stats")).toEqual({
      droppedJoinValues: [],
    });
    expect(droppedJoinInfoFromColumnStats(12)).toEqual({
      droppedJoinValues: [],
    });
  });

  it("returns empty values when join metadata is missing", () => {
    expect(droppedJoinInfoFromColumnStats({ table: "counts" })).toEqual({
      droppedJoinValues: [],
    });
    expect(droppedJoinInfoFromColumnStats({ join: null })).toEqual({
      droppedJoinValues: [],
    });
  });

  it("reads dropped sites from a valid column-stats join object", () => {
    expect(
      droppedJoinInfoFromColumnStats({
        join: {
          droppedJoinValues: ["SITE_A", "", 3, "SITE_B"],
          droppedRowCount: 4,
        },
      })
    ).toEqual({
      droppedJoinValues: ["SITE_A", "SITE_B"],
      droppedRowCount: 4,
    });
  });
});
