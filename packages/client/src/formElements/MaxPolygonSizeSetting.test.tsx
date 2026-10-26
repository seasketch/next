/* eslint-disable i18next/no-literal-string */
import { fireEvent, render, screen } from "@testing-library/react";
import { SketchGeometryType } from "../generated/graphql";
import MaxPolygonSizeSetting from "./MaxPolygonSizeSetting";

test("hides the size limit unless the geometry type is polygon", () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Point}
      value={null}
      onChange={onChange}
    />
  );
  expect(screen.queryByPlaceholderText("No limit")).not.toBeInTheDocument();

  rerender(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Polygon}
      value={4}
      onChange={onChange}
    />
  );
  expect(screen.getByPlaceholderText("No limit")).toHaveValue(4);
});

test("saves a positive area and clears a blank field", () => {
  const onChange = jest.fn();
  render(
    <MaxPolygonSizeSetting
      geometryType={SketchGeometryType.Polygon}
      value={null}
      onChange={onChange}
    />
  );
  const input = screen.getByPlaceholderText("No limit");
  fireEvent.change(input, { target: { value: "12.5" } });
  expect(onChange).toHaveBeenLastCalledWith(12.5);

  fireEvent.change(input, { target: { value: "" } });
  expect(onChange).toHaveBeenLastCalledWith(null);

  fireEvent.change(input, { target: { value: "0" } });
  fireEvent.blur(input);
  expect(onChange).toHaveBeenLastCalledWith(null);
});
