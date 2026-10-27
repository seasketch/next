/* eslint-disable i18next/no-literal-string */
import { fireEvent, render, screen } from "@testing-library/react";
import { SketchGeometryType } from "../generated/graphql";
import DigitizingTools from "./DigitizingTools";
import { DigitizingState } from "../draw/useMapboxGLDraw";

const handlers = {
  onRequestDelete: jest.fn(),
  onRequestSubmit: jest.fn(),
  onRequestEdit: jest.fn(),
  onRequestFinishEditing: jest.fn(),
  onRequestResetFeature: jest.fn(),
};

function renderTools(
  sizeWarning?: { areaSqKm: number; maxSqKm: number },
  state = DigitizingState.UNFINISHED
) {
  return render(
    <DigitizingTools
      geometryType={SketchGeometryType.Polygon}
      state={state}
      {...handlers}
      unfinishedStateButtons={<button type="button">Done</button>}
      sizeWarning={sizeWarning}
    />
  );
}

test("blocks finishing an over-size polygon and explains how to shrink it", () => {
  renderTools({ areaSqKm: 12.4, maxSqKm: 1 });

  expect(
    document.body.textContent?.replace(/\s/g, " ")
  ).toMatch(/This shape is over the size limit of 1 km²/);
  expect(screen.getByText("+1,140%")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Shape Too Large" })
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Shape Too Large" }));
  expect(
    screen.getByText(/Drag the points inward until the red highlight goes away/)
  ).toBeInTheDocument();
});

test("shows Done when the polygon is within the size limit", () => {
  renderTools(undefined);
  expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Shape Too Large" })
  ).not.toBeInTheDocument();
});
