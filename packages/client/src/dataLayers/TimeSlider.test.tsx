/* eslint-disable i18next/no-literal-string */
import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TemporalInfo } from "@seasketch/geostats-types";
import TimeSlider from "./TimeSlider";
import {
  MapTemporalStateContext,
  MapTemporalStateValue,
} from "./MapTemporalStateContext";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

const temporal: TemporalInfo = {
  version: 1,
  granularity: "row",
  coverage: {
    kind: "interval",
    start: "2018",
    end: "2021",
    precision: "year",
  },
  nativeResolution: "year",
  defaultViewResolution: "year",
  mapping: {
    type: "row",
    startColumn: "_when_start",
    endColumn: "_when_end",
  },
  authoredBy: "admin",
};

function renderSlider(loading: boolean) {
  const value: MapTemporalStateValue = {
    enabled: true,
    clock: {
      mode: "instant",
      start: "2018",
      end: "2019",
      viewResolution: "year",
    },
    domain: {
      kind: "interval",
      start: "2018",
      end: "2021",
      precision: "year",
    },
    resolution: "year",
    availableResolutions: ["year"],
    temporalSources: [
      {
        kind: "dataTable",
        tocStableId: "sites",
        dataSourceId: 1,
        tableStableId: "fish",
        temporal,
      },
    ],
    queryStepCounts: {
      fish: { "2018": 10, "2019": 5, "2020": 2 },
    },
    queryStepCountsLoading: loading,
    queryErrors: [],
    setClock: jest.fn(),
    setViewResolution: jest.fn(),
  };
  return render(
    <MemoryRouter>
      <MapTemporalStateContext.Provider value={value}>
        <TimeSlider />
      </MapTemporalStateContext.Provider>
    </MemoryRouter>
  );
}

describe("TimeSlider histogram loading", () => {
  it("paints observation counts in the active color when settled", () => {
    const { container } = renderSlider(false);
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
    expect(container.querySelector(".bg-sky-300\\/55")).toBeTruthy();
    expect(container.querySelector(".bg-gray-400\\/40")).toBeNull();
  });

  it("greys and pulses the same bars while series counts are loading", () => {
    const { container } = renderSlider(true);
    const track = container.querySelector("[aria-busy='true']");
    expect(track).toBeTruthy();
    expect(track?.className).toMatch(/animate-pulse/);
    expect(container.querySelector(".bg-gray-400\\/40")).toBeTruthy();
    expect(container.querySelector(".bg-sky-300\\/55")).toBeNull();
    expect(screen.getByText("Loading observation counts")).toBeInTheDocument();
  });
});
