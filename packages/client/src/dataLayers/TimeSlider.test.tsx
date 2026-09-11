/* eslint-disable i18next/no-literal-string */
import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
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
  const setClock = jest.fn();
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
    setClock,
    setViewResolution: jest.fn(),
  };
  const view = render(
    <MemoryRouter>
      <MapTemporalStateContext.Provider value={value}>
        <TimeSlider />
      </MapTemporalStateContext.Provider>
    </MemoryRouter>
  );
  return { ...view, setClock };
}

describe("TimeSlider coverage loading", () => {
  it("paints occupied steps on the track when settled", () => {
    const { container } = renderSlider(false);
    expect(container.querySelector("[aria-busy='true']")).toBeNull();
    expect(container.querySelector(".timeslider-coverage")).toBeTruthy();
    expect(container.querySelector(".timeslider-coverage-loading")).toBeNull();
  });

  it("draws track axis ticks and year labels", () => {
    const { getByTestId } = renderSlider(false);
    const axis = getByTestId("timeslider-axis");
    expect(axis.querySelectorAll(".timeslider-axis-mark").length).toBeGreaterThan(
      0
    );
    expect(axis.textContent).toMatch(/2018/);
  });

  it("greys and pulses the track while series counts are loading", () => {
    const { container } = renderSlider(true);
    const track = container.querySelector("[aria-busy='true']");
    expect(track).toBeTruthy();
    expect(container.querySelector(".timeslider-coverage-loading")).toBeTruthy();
    expect(container.querySelector(".timeslider-coverage")).toBeNull();
    expect(screen.getByText("Loading observation counts")).toBeInTheDocument();
  });

  it("greys the track in range mode while a map query is in flight", () => {
    const { container } = renderSlider(true, {
      mode: "window",
      start: "2018",
      end: "2021",
      viewResolution: "year",
    });
    const track = container.querySelector("[aria-busy='true']");
    expect(track).toBeTruthy();
    expect(container.querySelector(".timeslider-coverage-loading")).toBeTruthy();
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

  it("keeps presence coverage on the track while a window is selected", () => {
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
    expect(container.querySelector(".timeslider-coverage")).toBeTruthy();
    expect(container.querySelector(".bg-sky-200\\/55")).toBeTruthy();
  });
});

describe("TimeSlider Single / Range mode", () => {
  beforeAll(() => {
    Object.assign(Element.prototype, {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      hasPointerCapture: () => false,
    });
  });

  it("shows Single and Range as a pressed-state switch", () => {
    renderSlider(false);
    expect(screen.getByRole("button", { name: "Single" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Range" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("opens a full-domain window when Range is chosen", () => {
    const { setClock } = renderSlider(false);
    fireEvent.click(screen.getByRole("button", { name: "Range" }));
    expect(setClock).toHaveBeenCalledWith({
      mode: "window",
      start: "2018",
      end: "2021",
      viewResolution: "year",
    });
  });

  it("does not change the clock when the active mode is clicked again", () => {
    const { setClock } = renderSlider(false);
    fireEvent.click(screen.getByRole("button", { name: "Single" }));
    expect(setClock).not.toHaveBeenCalled();
  });

  it("returns to instant on the last included step", () => {
    const { setClock } = renderSlider(false, {
      mode: "window",
      start: "2018",
      end: "2021",
      viewResolution: "year",
    });
    fireEvent.click(screen.getByRole("button", { name: "Single" }));
    expect(setClock).toHaveBeenCalledWith({
      mode: "instant",
      start: "2020",
      end: "2021",
      viewResolution: "year",
    });
  });

  it("does not keep the end handle captured after pointerup", () => {
    const { container, setClock } = renderSlider(false, {
      mode: "window",
      start: "2018",
      end: "2021",
      viewResolution: "year",
    });
    const track = container.querySelector(".timeslider-track");
    expect(track).toBeTruthy();
    jest.spyOn(track!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 32,
      right: 200,
      width: 200,
      height: 32,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(track!, {
      button: 0,
      buttons: 1,
      clientX: 190,
      pointerId: 1,
    });
    expect(setClock).toHaveBeenCalled();
    const callsAfterDown = setClock.mock.calls.length;
    fireEvent.pointerUp(track!, { button: 0, buttons: 0, pointerId: 1 });
    fireEvent.pointerMove(track!, { buttons: 0, clientX: 20, pointerId: 1 });
    expect(setClock.mock.calls.length).toBe(callsAfterDown);
  });
});
