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

function renderSlider(
  loading: boolean,
  clock: MapTemporalStateValue["clock"] = {
    mode: "instant",
    start: "2018",
    end: "2019",
    viewResolution: "year",
  }
) {
  const value: MapTemporalStateValue = {
    enabled: true,
    clock,
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
    expect(container.querySelector(".bg-sky-300\\/70")).toBeTruthy();
    expect(container.querySelector(".bg-gray-400\\/40")).toBeNull();
  });

  it("greys and pulses the same bars while series counts are loading", () => {
    const { container } = renderSlider(true);
    const track = container.querySelector("[aria-busy='true']");
    expect(track).toBeTruthy();
    expect(track?.className).toMatch(/animate-pulse/);
    expect(container.querySelector(".bg-gray-400\\/40")).toBeTruthy();
    expect(container.querySelector(".bg-sky-300\\/70")).toBeNull();
    expect(screen.getByText("Loading observation counts")).toBeInTheDocument();
  });

  it("greys range-mode histogram bars while a map query is in flight", () => {
    const { container } = renderSlider(true, {
      mode: "window",
      start: "2018",
      end: "2021",
      viewResolution: "year",
    });
    const track = container.querySelector("[aria-busy='true']");
    expect(track).toBeTruthy();
    expect(track?.className).toMatch(/animate-pulse/);
    expect(container.querySelector(".bg-gray-400\\/40")).toBeTruthy();
  });

  it("sits range handles on the first and last step edges", () => {
    const { getByTestId, queryByTestId } = renderSlider(false, {
      mode: "window",
      start: "2018",
      end: "2021",
      viewResolution: "year",
    });
    expect(queryByTestId("timeslider-range-start")).toHaveStyle({ left: "0%" });
    expect(queryByTestId("timeslider-range-end")).toHaveStyle({
      left: "100%",
    });
    expect(getByTestId("timeslider-range-start")).toBeInTheDocument();
  });

  it("spans a partial window from the first step start to the last step end", () => {
    const { getByTestId } = renderSlider(false, {
      mode: "window",
      start: "2019",
      end: "2021",
      viewResolution: "year",
    });
    // 2018 | 2019 | 2020 — window is 2019–2021 exclusive → 2019 and 2020
    expect(getByTestId("timeslider-range-start")).toHaveStyle({
      left: "33.3333%",
    });
    expect(getByTestId("timeslider-range-end")).toHaveStyle({
      left: "100%",
    });
  });

  it("highlights only the histogram bins inside the window", () => {
    const { container, getByTestId } = renderSlider(false, {
      mode: "window",
      start: "2019",
      end: "2021-01-01T00:00:00.000Z",
      viewResolution: "year",
    });
    expect(getByTestId("timeslider-range-start")).toHaveStyle({
      left: "33.3333%",
    });
    expect(getByTestId("timeslider-range-end")).toHaveStyle({
      left: "100%",
    });
    expect(container.querySelectorAll(".bg-sky-300\\/70")).toHaveLength(2);
    expect(container.querySelectorAll(".bg-sky-300\\/20")).toHaveLength(1);
  });
});
