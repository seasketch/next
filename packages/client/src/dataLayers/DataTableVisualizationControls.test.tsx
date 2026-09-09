/* eslint-disable i18next/no-literal-string */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import DataTableVisualizationControls from "./DataTableVisualizationControls";
import { MapOverlayContext } from "./MapContextManager";

describe("DataTableVisualizationControls labels", () => {
  it("shows the custom label on the column trigger", () => {
    render(
      <MapOverlayContext.Provider
        value={{
          layerStatesByTocStaticId: {
            sites: {
              dataTable: {
                stableId: "effort",
                column: "CPUE_catch_per_angler_hour",
                op: "mean",
              },
            },
          },
          styleHash: "",
        }}
      >
        <DataTableVisualizationControls
          layerId="sites"
          metadata={{
            visualizationColumns: [
              "CPUE_catch_per_angler_hour",
              "BPUE_biomass(kg)_per_angler_hour",
            ],
            visualizationOps: ["mean"],
            filterColumnLabels: {
              CPUE_catch_per_angler_hour: "CPUE",
            },
          }}
        />
      </MapOverlayContext.Provider>
    );
    expect(screen.getByLabelText("Visualize column")).toHaveTextContent("CPUE");
    expect(
      screen.queryByLabelText("Visualize column")?.textContent
    ).not.toMatch(/CPUE_catch_per_angler_hour/);
  });

  it("labels the admin-allowed column when layer state still has a stale pick", () => {
    render(
      <MapOverlayContext.Provider
        value={{
          layerStatesByTocStaticId: {
            sites: {
              dataTable: {
                stableId: "catch",
                column: "Latitude",
                op: "mean",
              },
            },
          },
          styleHash: "",
        }}
      >
        <DataTableVisualizationControls
          layerId="sites"
          metadata={{
            visualizationColumns: ["Amount"],
            visualizationOps: ["mean"],
          }}
        />
      </MapOverlayContext.Provider>
    );
    expect(screen.getByText("Amount")).toBeTruthy();
    expect(screen.queryByText("Latitude")).toBeNull();
  });
});
