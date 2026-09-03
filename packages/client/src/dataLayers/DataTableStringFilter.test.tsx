/* eslint-disable i18next/no-literal-string */
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import DataTableStringFilter from "./DataTableStringFilter";
import { DataTableFilter } from "./dataTableQueryApi";

const speciesColumn: GeostatsAttribute = {
  attribute: "species",
  type: "string",
  count: 3,
  values: {
    anchovy: 1,
    bass: 2,
    cod: 3,
  },
};

function renderFilter(
  filters: DataTableFilter[],
  onChange = jest.fn<(filters: DataTableFilter[]) => void>()
) {
  render(
    <DataTableStringFilter
      column={speciesColumn}
      filters={filters}
      onChange={onChange}
    />
  );
  return onChange;
}

describe("DataTableStringFilter multi-select", () => {
  it("selects all and none after enabling multi-select", () => {
    const onChange = renderFilter([
      { column: "species", op: "eq", value: "bass" },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /bass/i }));
    expect(screen.getByLabelText("Select multiple")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();

    fireEvent.click(screen.getByLabelText("Select multiple"));
    expect(onChange).toHaveBeenLastCalledWith([
      { column: "species", op: "in", values: ["bass"] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { column: "species", op: "in", values: ["bass", "anchovy", "cod"] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { column: "species", op: "eq", value: "" },
    ]);
  });

  it("select all only adds values matching the search", () => {
    const onChange = renderFilter([
      { column: "species", op: "in", values: ["bass"] },
    ]);

    fireEvent.click(screen.getByRole("button", { name: /bass/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));

    expect(onChange).toHaveBeenLastCalledWith([
      { column: "species", op: "in", values: ["bass", "anchovy"] },
    ]);
  });
});
