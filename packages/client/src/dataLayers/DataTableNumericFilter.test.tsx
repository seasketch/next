/* eslint-disable i18next/no-literal-string */
import { describe, expect, it, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import DataTableNumericFilter, {
  INPUT_COMMIT_DEBOUNCE_MS,
  isReadyRangeDraft,
} from "./DataTableNumericFilter";
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

const countColumn: GeostatsAttribute = {
  attribute: "count",
  type: "number",
  count: 100,
  min: 2,
  max: 33,
  values: {
    "2": 1,
    "10": 1,
    "15": 1,
    "33": 1,
  },
};

function rangeFilters(
  min: string,
  max: string,
  column = "depth"
): DataTableFilter[] {
  return [
    { column, op: "gte", value: min },
    { column, op: "lte", value: max },
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
    fireEvent.blur(screen.getByLabelText("Min"));

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

describe("isReadyRangeDraft", () => {
  it("rejects nullish and non-numeric values", () => {
    expect(isReadyRangeDraft(Number.NaN, 10, "min", 2, 33)).toBe(false);
    expect(isReadyRangeDraft(Number.POSITIVE_INFINITY, 10, "min", 2, 33)).toBe(
      false
    );
  });

  it("rejects values outside the column bounds", () => {
    expect(isReadyRangeDraft(1, 33, "min", 2, 33)).toBe(false);
    expect(isReadyRangeDraft(40, 2, "max", 2, 33)).toBe(false);
  });

  it("rejects an inverted range against the other bound", () => {
    expect(isReadyRangeDraft(20, 10, "min", 2, 33)).toBe(false);
    expect(isReadyRangeDraft(5, 10, "max", 2, 33)).toBe(false);
  });

  it("accepts an in-range bound, including when the other side is empty", () => {
    expect(isReadyRangeDraft(10, 33, "min", 2, 33)).toBe(true);
    expect(isReadyRangeDraft(10, null, "min", 2, 33)).toBe(true);
    expect(isReadyRangeDraft(10, 2, "max", 2, 33)).toBe(true);
  });
});

describe("DataTableNumericFilter exact input drafts", () => {
  function renderCountFilter(
    filters: DataTableFilter[] = rangeFilters("2", "33", "count")
  ) {
    const onChange = jest.fn<(filters: DataTableFilter[]) => void>();
    const view = render(
      <DataTableNumericFilter
        column={countColumn}
        filters={filters}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /–/ }));
    return { onChange, ...view };
  }

  it("keeps a below-min prefix in the field and does not emit", () => {
    const { onChange } = renderCountFilter();
    const minInput = screen.getByLabelText("Min");

    fireEvent.change(minInput, { target: { value: "1" } });

    expect(minInput).toHaveValue(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /2\s+–\s+33/ })
    ).toBeInTheDocument();
  });

  it("lets the user type 10 when the column min is 2", () => {
    jest.useFakeTimers();
    try {
      const { onChange } = renderCountFilter();
      const minInput = screen.getByLabelText("Min");

      fireEvent.change(minInput, { target: { value: "1" } });
      expect(minInput).toHaveValue(1);
      expect(onChange).not.toHaveBeenCalled();

      fireEvent.change(minInput, { target: { value: "10" } });
      expect(minInput).toHaveValue(10);
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(INPUT_COMMIT_DEBOUNCE_MS);
      });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toEqual(
        rangeFilters("10", "33", "count")
      );
      expect(minInput).toHaveValue(10);
    } finally {
      jest.useRealTimers();
    }
  });

  it("clamps a below-min draft on blur", () => {
    const { onChange } = renderCountFilter(rangeFilters("5", "33", "count"));
    const minInput = screen.getByLabelText("Min");

    fireEvent.change(minInput, { target: { value: "1" } });
    fireEvent.blur(minInput);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(rangeFilters("2", "33", "count"));
    expect(minInput).toHaveValue(2);
  });

  it("clamps a below-min draft on Enter", () => {
    const { onChange } = renderCountFilter(rangeFilters("5", "33", "count"));
    const minInput = screen.getByLabelText("Min");

    fireEvent.change(minInput, { target: { value: "1" } });
    fireEvent.keyDown(minInput, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(rangeFilters("2", "33", "count"));
    expect(minInput).toHaveValue(2);
  });

  it("does not emit while the field is cleared, then commits empty on blur", () => {
    const { onChange } = renderCountFilter();
    const minInput = screen.getByLabelText("Min");

    fireEvent.change(minInput, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(minInput).toHaveValue(null);

    fireEvent.blur(minInput);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([
      { column: "count", op: "lte", value: "33" },
    ]);
  });

  it("commits an in-progress in-range draft when the popover closes", () => {
    const { onChange } = renderCountFilter();
    const trigger = screen.getByRole("button", { name: /–/ });
    const minInput = screen.getByLabelText("Min");

    fireEvent.change(minInput, { target: { value: "1" } });
    fireEvent.change(minInput, { target: { value: "10" } });
    fireEvent.click(trigger);

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toEqual(rangeFilters("10", "33", "count"));
  });
});
