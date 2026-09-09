import { describe, expect, it } from "@jest/globals";
import {
  DATA_TABLE_SETTINGS_MEMORY_LIMIT,
  lookupDataTableSettings,
  parseDataTableSettingsMemory,
  rememberDataTableSettings,
  resolveLayerDataTableChange,
} from "./dataTableSettingsMemory";

describe("parseDataTableSettingsMemory", () => {
  it("rejects null, undefined, and non-arrays", () => {
    expect(parseDataTableSettingsMemory(null)).toEqual([]);
    expect(parseDataTableSettingsMemory(undefined)).toEqual([]);
    expect(parseDataTableSettingsMemory({ stableId: "t1" })).toEqual([]);
  });

  it("drops invalid entries and duplicate stableIds", () => {
    expect(
      parseDataTableSettingsMemory([
        null,
        { stableId: "t1", column: "biomass", op: "sum", updatedAt: 1 },
        { stableId: "t1", column: "later" },
        { column: "no-id" },
        { stableId: "t2", op: "nope" },
        {
          stableId: "t3",
          filters: [{ column: "species", op: "eq", value: "kelp" }],
          updatedAt: 2,
        },
      ])
    ).toEqual([
      { stableId: "t1", column: "biomass", op: "sum", updatedAt: 1 },
      {
        stableId: "t3",
        filters: [{ column: "species", op: "eq", value: "kelp" }],
        updatedAt: 2,
      },
    ]);
  });
});

describe("rememberDataTableSettings", () => {
  it("moves an existing table to the front and evicts past the limit", () => {
    let memory = rememberDataTableSettings([], { stableId: "a" }, 1);
    memory = rememberDataTableSettings(memory, { stableId: "b" }, 2);
    memory = rememberDataTableSettings(
      memory,
      { stableId: "a", column: "cpue", op: "mean" },
      3
    );
    expect(memory.map((entry) => entry.stableId)).toEqual(["a", "b"]);
    expect(memory[0].column).toBe("cpue");

    for (let i = 0; i < DATA_TABLE_SETTINGS_MEMORY_LIMIT + 2; i += 1) {
      memory = rememberDataTableSettings(
        memory,
        { stableId: `t${i}` },
        10 + i
      );
    }
    expect(memory).toHaveLength(DATA_TABLE_SETTINGS_MEMORY_LIMIT);
    expect(memory[0].stableId).toBe(`t${DATA_TABLE_SETTINGS_MEMORY_LIMIT + 1}`);
    expect(lookupDataTableSettings(memory, "a")).toBeUndefined();
  });
});

describe("resolveLayerDataTableChange", () => {
  it("does not carry filters when switching to a new table", () => {
    const { next, memory } = resolveLayerDataTableChange(
      {
        stableId: "fish",
        column: "density",
        op: "mean",
        filters: [{ column: "species", op: "eq", value: "bull kelp" }],
      },
      { stableId: "birds" },
      []
    );
    expect(next).toEqual({ stableId: "birds" });
    expect(lookupDataTableSettings(memory, "fish")?.filters).toEqual([
      { column: "species", op: "eq", value: "bull kelp" },
    ]);
    expect(lookupDataTableSettings(memory, "birds")).toBeUndefined();
  });

  it("restores the last settings when returning to a remembered table", () => {
    const first = resolveLayerDataTableChange(
      {
        stableId: "fish",
        column: "density",
        op: "mean",
        filters: [{ column: "species", op: "eq", value: "Kelp Bass" }],
      },
      { stableId: "birds" },
      []
    );
    const second = resolveLayerDataTableChange(
      first.next || undefined,
      { stableId: "fish" },
      first.memory
    );
    expect(second.next).toEqual({
      stableId: "fish",
      column: "density",
      op: "mean",
      filters: [{ column: "species", op: "eq", value: "Kelp Bass" }],
    });
  });

  it("keeps explicit incoming settings and remembers them", () => {
    const { next, memory } = resolveLayerDataTableChange(
      { stableId: "fish", filters: [{ column: "year", op: "eq", value: "2020" }] },
      {
        stableId: "fish",
        column: "biomass",
        op: "sum",
        filters: [{ column: "species", op: "eq", value: "Kelp Bass" }],
      },
      []
    );
    expect(next?.column).toBe("biomass");
    expect(lookupDataTableSettings(memory, "fish")?.filters).toEqual([
      { column: "species", op: "eq", value: "Kelp Bass" },
    ]);
  });

  it("remembers the previous table when clearing visualization", () => {
    const { next, memory } = resolveLayerDataTableChange(
      {
        stableId: "fish",
        filters: [{ column: "species", op: "eq", value: "Kelp Bass" }],
      },
      null,
      []
    );
    expect(next).toBeNull();
    expect(lookupDataTableSettings(memory, "fish")?.filters).toEqual([
      { column: "species", op: "eq", value: "Kelp Bass" },
    ]);
  });
});
