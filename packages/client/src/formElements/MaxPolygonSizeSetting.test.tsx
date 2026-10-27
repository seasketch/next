/* eslint-disable i18next/no-literal-string */
import { fireEvent, render, screen } from "@testing-library/react";
import { SketchGeometryType } from "../generated/graphql";
import MaxPolygonSizeSetting from "./MaxPolygonSizeSetting";

test("starts disabled until a unit is chosen", () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Point}
      value={null}
      onChange={onChange}
    />
  );
  expect(screen.queryByLabelText("Max size (optional)")).not.toBeInTheDocument();

  rerender(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Polygon}
      value={null}
      unit={null}
      onChange={onChange}
    />
  );
  const input = screen.getByLabelText("Max size (optional)");
  expect(input).toBeDisabled();
  expect(input).toHaveValue(null);
  expect(screen.getByLabelText("Unit")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
});

test("saves a size in the chosen unit and clears it", () => {
  const onChange = jest.fn();
  render(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Polygon}
      value={null}
      onChange={onChange}
    />
  );
  fireEvent.change(screen.getByLabelText("Unit"), {
    target: { value: "hectare" },
  });
  const input = screen.getByLabelText("Max size (optional)");
  expect(input).toBeEnabled();

  fireEvent.change(input, { target: { value: "12.5" } });
  expect(onChange).toHaveBeenLastCalledWith(0.125, "hectare");

  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(onChange).toHaveBeenLastCalledWith(null, null);
  expect(screen.getByLabelText("Unit")).toHaveValue("");
  expect(screen.getByLabelText("Max size (optional)")).toBeDisabled();
});

test("shows a saved square-kilometer limit and converts when the unit changes", () => {
  const onChange = jest.fn();
  render(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Polygon}
      value={1}
      unit="kilometer"
      onChange={onChange}
    />
  );
  expect(screen.getByLabelText("Max size (optional)")).toHaveValue(1);
  fireEvent.change(screen.getByLabelText("Unit"), {
    target: { value: "hectare" },
  });
  expect(onChange).toHaveBeenLastCalledWith(1, "hectare");
  expect(screen.getByLabelText("Max size (optional)")).toHaveValue(100);
});
