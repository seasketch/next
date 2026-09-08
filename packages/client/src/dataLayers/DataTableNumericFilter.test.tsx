/* eslint-disable i18next/no-literal-string */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import DataTableNumericFilter from "./DataTableNumericFilter";
import { DataTableFilter } from "./dataTableQueryApi";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(
  globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }
).ResizeObserver = ResizeObserverMock;

const depthColumn: GeostatsAttribute = {
  attribute: "depth",
  type: "number",
  count: 100,
  min: 0.2,
  max: 33.5,
  values: {
    "0.2": 1,
    "9.7": 1,
    "25.7": 1,
    "33.5": 1,
  },
};

function rangeFilters(min: string, max: string): DataTableFilter[] {
  return [
    { column: "depth", op: "gte", value: min },
    { column: "depth", op: "lte", value: max },
  ];
}

function renderFilter(
  filters: DataTableFilter[],
  onChange = jest.fn<(filters: DataTableFilter[]) => void>(),
  queryLoading = false
) {
  const view = render(
    <DataTableNumericFilter
      column={depthColumn}
      filters={filters}
      onChange={onChange}
      queryLoading={queryLoading}
    />
  );
  return { onChange, ...view };
}

describe("DataTableNumericFilter range consistency", () => {
  it("shows the committed range on the trigger", () => {
    renderFilter(rangeFilters("9.7", "25.7"));
    expect(
      screen.getByRole("button", { name: /9\.7\s+–\s+25\.7/ })
    ).toBeInTheDocument();
  });

  it("keeps the selected range when parent props lag after a change", () => {
    const { onChange, rerender } = renderFilter(rangeFilters("9.7", "25.7"));

    fireEvent.click(screen.getByRole("button", { name: /9\.7/ }));
    fireEvent.change(screen.getByLabelText("Min"), {
      target: { value: "12" },
    });

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(emitted).toEqual(rangeFilters("12", "25.7"));

    rerender(
      <DataTableNumericFilter
        column={depthColumn}
        filters={rangeFilters("9.7", "25.7")}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /12/ }));

    expect(
      screen.getByRole("button", { name: /12\s+–\s+25\.7/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /9\.7\s+–\s+25\.7/ })
    ).toBeNull();
  });

  it("commits an in-progress slider draft when the popover closes", () => {
    const { onChange } = renderFilter(rangeFilters("9.7", "25.7"));

    fireEvent.click(screen.getByRole("button", { name: /9\.7/ }));
    const sliders = screen.getAllByRole("slider");
    expect(sliders.length).toBe(2);
    fireEvent.keyDown(sliders[0], { key: "ArrowRight" });
    fireEvent.keyUp(sliders[0], { key: "ArrowRight" });

    expect(onChange.mock.calls.length).toBeGreaterThan(0);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const nextMin = last.find((filter) => filter.op === "gte")?.value;
    expect(nextMin).toBeDefined();
    expect(nextMin).not.toBe("9.7");

    fireEvent.click(screen.getByRole("button", { name: /–/ }));
    expect(
      screen.getByRole("button", { name: new RegExp(`${nextMin}`) })
    ).toBeInTheDocument();
  });

  it("marks the trigger busy while the map query is in flight", () => {
    renderFilter(rangeFilters("9.7", "25.7"), undefined, true);
    expect(
      screen.getByRole("button", { name: /9\.7\s+–\s+25\.7/ })
    ).toHaveAttribute("aria-busy", "true");
  });
});
