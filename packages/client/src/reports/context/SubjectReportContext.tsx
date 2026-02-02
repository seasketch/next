import { createContext, useContext, useMemo } from "react";
import {
  ReportContextSketchDetailsFragment,
  Sketch,
  SketchGeometryType,
  useSubjectReportContextQuery,
} from "../../generated/graphql";
import { MetricSubjectFragment } from "overlay-engine";
import { BaseReportContext } from "./BaseReportContext";

type SubjectReportContextData = {
  /**
   * Whether the sketch is a collection
   */
  isCollection: boolean;
  sketch: ReportContextSketchDetailsFragment;
  childSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  siblingSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  relatedFragments: MetricSubjectFragment[];
};

export const SubjectReportContext = createContext<{
  data?: SubjectReportContextData;
  loading: boolean;
}>({ loading: true });

export function SubjectReportContextProvider({
  children,
  sketchId,
}: {
  children: React.ReactNode;
  sketchId: number;
}) {
  const { data, loading } = useSubjectReportContextQuery({
    variables: {
      sketchId: sketchId,
    },
  });
  const value = useMemo<SubjectReportContextData | undefined>(() => {
    if (data) {
      if (!data.sketch) {
        throw new Error("Sketch not found");
      }
      if (!data.sketch.sketchClass) {
        throw new Error("Sketch class not found");
      }
      return {
        sketch: data.sketch,
        childSketches: data.sketch.children || [],
        siblingSketches: data.sketch.siblings || [],
        relatedFragments:
          (data.sketch.relatedFragments as MetricSubjectFragment[]) || [],
        isCollection:
          data.sketch.sketchClass?.geometryType ===
          SketchGeometryType.Collection,
      };
    }
    return undefined;
  }, [data]);

  return (
    <SubjectReportContext.Provider value={{ data: value, loading }}>
      {children}
    </SubjectReportContext.Provider>
  );
}

export function useSubjectReportContext() {
  const context = useContext(SubjectReportContext);
  return context;
}
