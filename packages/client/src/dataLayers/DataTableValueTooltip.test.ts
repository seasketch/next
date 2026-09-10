import { describe, expect, it } from "@jest/globals";
import {
  dataTableSparklineLayout,
  dataTableTooltipContextLabel,
  formatDataTableSiteLabel,
  formatDataTableTooltipRange,
  pickSparklineXTicks,
  thinOverlappingXTicks,
} from "./DataTableValueTooltip";

describe("formatDataTableSiteLabel", () => {
  it("humanizes underscored join keys and keeps short tokens uppercase", () => {
    expect(formatDataTableSiteLabel("ANACAPPA_WEST_ISLE_W")).toBe(
      "Anacappa West Isle W"
    );
    expect(formatDataTableSiteLabel("IV_REEF_E")).toBe("IV Reef E");
    expect(formatDataTableSiteLabel("WHITE_ROCK_DC")).toBe("White Rock DC");
  });

  it("leaves already-readable names alone and ignores blanks", () => {
    expect(formatDataTableSiteLabel("White Rock")).toBe("White Rock");
    expect(formatDataTableSiteLabel("  ")).toBeUndefined();
    expect(formatDataTableSiteLabel(undefined)).toBeUndefined();
  });
});

describe("formatDataTableTooltipRange", () => {
  it("formats an inclusive year window and skips instant clocks", () => {
    expect(
      formatDataTableTooltipRange(["1999", "2000", "2024"])
    ).toBe("1999 – 2024");
    expect(formatDataTableTooltipRange(["2024"])).toBeUndefined();
    expect(formatDataTableTooltipRange([])).toBeUndefined();
    expect(formatDataTableTooltipRange(undefined)).toBeUndefined();
  });
});

describe("dataTableTooltipContextLabel", () => {
  it("prefers the table name over the layer title", () => {
    expect(
      dataTableTooltipContextLabel("Fish surveys", "Monitoring sites")
    ).toBe("Fish surveys");
  });

  it("falls back to the layer title and ignores blanks", () => {
    expect(dataTableTooltipContextLabel("  ", "Monitoring sites")).toBe(
      "Monitoring sites"
    );
    expect(dataTableTooltipContextLabel(undefined, undefined)).toBeUndefined();
    expect(dataTableTooltipContextLabel(null as unknown as string)).toBeUndefined();
  });
});

describe("dataTableSparklineLayout", () => {
  it("builds a line through numeric points and marks the current step", () => {
    const layout = dataTableSparklineLayout(
      [
        { step: "2018", value: 10 },
        { step: "2019", value: null },
        { step: "2020", value: 4 },
        { step: "2021", value: 6 },
      ],
      ["2021"]
    );
    expect(layout.segments).toHaveLength(1);
    expect(layout.gapSegments).toHaveLength(1);
    expect(layout.observedDots).toHaveLength(3);
    expect(layout.currentDots).toHaveLength(1);
    expect(layout.yTicks.length).toBeGreaterThanOrEqual(2);
    expect(layout.yTicks.length).toBeLessThanOrEqual(4);
    expect(layout.xTicks[0].label).toBe("2018");
    expect(layout.xTicks[layout.xTicks.length - 1].label).toBe("2021");
    expect(layout.firstStep).toBe("2018");
    expect(layout.lastStep).toBe("2021");
    expect(layout.window).not.toBeNull();
  });

  it("adds intermediate year ticks without crowding the endpoints", () => {
    const years = Array.from({ length: 24 }, (_, index) => ({
      step: String(2001 + index),
      value: 1 + (index % 5),
    }));
    const layout = dataTableSparklineLayout(years, ["2024"]);
    const labels = layout.xTicks.map((tick) => tick.label);
    expect(labels[0]).toBe("2001");
    expect(labels[labels.length - 1]).toBe("2024");
    expect(layout.xTicks.length).toBeGreaterThanOrEqual(3);
    expect(layout.xTicks.length).toBeLessThanOrEqual(5);
    expect(layout.yTicks.some((tick) => tick.label === "0")).toBe(true);
    expect(layout.yTicks.length).toBeGreaterThanOrEqual(3);
  });
});

describe("thinOverlappingXTicks", () => {
  it("keeps endpoints and drops a label that would collide", () => {
    const thinned = thinOverlappingXTicks([
      { x: 0, label: "2001", anchor: "start" as const },
      { x: 12, label: "2005", anchor: "middle" as const },
      { x: 120, label: "2024", anchor: "end" as const },
    ]);
    expect(thinned.map((tick) => tick.label)).toEqual(["2001", "2024"]);
  });
});

describe("pickSparklineXTicks", () => {
  it("snaps d3 time ticks onto actual year steps", () => {
    const steps = Array.from({ length: 24 }, (_, index) => String(2001 + index));
    const ticks = pickSparklineXTicks(steps, { x: 28, width: 196 });
    expect(ticks[0].label).toBe("2001");
    expect(ticks[ticks.length - 1].label).toBe("2024");
    expect(ticks.length).toBeGreaterThan(2);
    const xs = ticks.map((tick) => tick.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});
