import React from "react";
import { render, act } from "@testing-library/react";
import { useReportState } from "./ReportContext";
import { SpatialMetricDependency } from "../generated/graphql";

// Test component to wrap the hook
function TestComponent({ onUpdate }: { onUpdate: (result: any) => void }) {
  const result = useReportState(undefined);

  // Call onUpdate on every render to capture state changes
  React.useLayoutEffect(() => {
    onUpdate(result);
  });

  return null;
}

describe("ReportContext - Metric Dependencies", () => {
  describe("addMetricDependency", () => {
    it("should add a new dependency when none exists", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual(dependency);
    });

    it("should add multiple unique dependencies", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency1: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      const dependency2: SpatialMetricDependency = {
        type: "count",
        geographyId: 2,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency1);
      });

      act(() => {
        hookResult.addMetricDependency(2, dependency2);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContainEqual(dependency1);
      expect(dependencies).toContainEqual(dependency2);
    });

    it("should track multiple hooks sharing the same dependency", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
        hookResult.addMetricDependency(2, dependency); // Same dependency, different hook
        hookResult.addMetricDependency(3, dependency); // Same dependency, different hook
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1); // Should only have one unique dependency
      expect(dependencies[0]).toEqual(dependency);
    });

    it("should handle dependencies with different geographyIds as unique", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency1: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      const dependency2: SpatialMetricDependency = {
        type: "area",
        geographyId: 2,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency1);
      });

      act(() => {
        hookResult.addMetricDependency(2, dependency2);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContainEqual(dependency1);
      expect(dependencies).toContainEqual(dependency2);
    });

    it("should handle dependencies with different types as unique", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency1: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      const dependency2: SpatialMetricDependency = {
        type: "count",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency1);
      });

      act(() => {
        hookResult.addMetricDependency(2, dependency2);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(2);
      expect(dependencies).toContainEqual(dependency1);
      expect(dependencies).toContainEqual(dependency2);
    });
  });

  describe("removeMetricDependency", () => {
    it("should remove a dependency when no hooks remain", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
      });

      let dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1);

      act(() => {
        hookResult.removeMetricDependency(1, dependency);
      });

      dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(0);
    });

    it("should not remove a dependency when other hooks still reference it", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
        hookResult.addMetricDependency(2, dependency);
        hookResult.addMetricDependency(3, dependency);
      });

      let dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1);

      act(() => {
        hookResult.removeMetricDependency(1, dependency);
      });

      dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1); // Should still exist
      expect(dependencies[0]).toEqual(dependency);

      act(() => {
        hookResult.removeMetricDependency(2, dependency);
      });

      dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1); // Should still exist

      act(() => {
        hookResult.removeMetricDependency(3, dependency);
      });

      dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(0); // Now should be removed
    });

    it("should handle removing non-existent dependencies gracefully", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.removeMetricDependency(999, dependency);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(0);
    });
  });

  describe("getMetricDependencies", () => {
    it("should return empty array when no dependencies exist", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toEqual([]);
    });

    it("should return unique dependencies only", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
        hookResult.addMetricDependency(2, dependency);
        hookResult.addMetricDependency(3, dependency);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual(dependency);
    });

    it("should not include internal hash and hooks properties", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies[0]).not.toHaveProperty("hash");
      expect(dependencies[0]).not.toHaveProperty("hooks");
      expect(dependencies[0]).toEqual(dependency);
    });

    it("should handle complex dependency objects", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "presence_table",
        geographyId: 1,
        overlay_stable_id: "test-overlay",
        overlay_group_by: "category",
        included_properties: ["prop1", "prop2"],
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]).toEqual(dependency);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex scenario with multiple hooks and dependencies", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const areaDependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      const countDependency: SpatialMetricDependency = {
        type: "count",
        geographyId: 2,
      };

      // Add dependencies
      act(() => {
        hookResult.addMetricDependency(1, areaDependency);
      });

      act(() => {
        hookResult.addMetricDependency(2, areaDependency); // Shared
      });

      act(() => {
        hookResult.addMetricDependency(3, countDependency);
      });

      act(() => {
        hookResult.addMetricDependency(4, countDependency); // Shared
      });

      let dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(2);

      // Remove some hooks
      act(() => {
        hookResult.removeMetricDependency(1, areaDependency);
        hookResult.removeMetricDependency(3, countDependency);
      });

      dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(2); // Should still have both

      // Remove remaining hooks
      act(() => {
        hookResult.removeMetricDependency(2, areaDependency);
      });

      act(() => {
        hookResult.removeMetricDependency(4, countDependency);
      });

      dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(0); // Should be empty
    });

    it("should handle rapid add/remove operations", () => {
      let hookResult: any = null;

      render(
        <TestComponent
          onUpdate={(result) => {
            hookResult = result;
          }}
        />
      );

      const dependency: SpatialMetricDependency = {
        type: "area",
        geographyId: 1,
      };

      act(() => {
        hookResult.addMetricDependency(1, dependency);
        hookResult.removeMetricDependency(1, dependency);
        hookResult.addMetricDependency(2, dependency);
        hookResult.addMetricDependency(3, dependency);
        hookResult.removeMetricDependency(2, dependency);
      });

      const dependencies = hookResult.getMetricDependencies();
      expect(dependencies).toHaveLength(1); // Should still have one
      expect(dependencies[0]).toEqual(dependency);
    });
  });
});
