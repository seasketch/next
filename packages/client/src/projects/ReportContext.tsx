import { useCallback, useMemo, useState } from "react";
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
} from "react";
import { useProjectMetadataQuery } from "../generated/graphql";
import getSlug from "../getSlug";
import SketchReportWindow, {
  ReportWindowUIState,
} from "./Sketches/SketchReportWindow";

type ReportState = {
  sketchId: number;
  uiState: ReportWindowUIState;
  sketchClassId: number;
};

interface ReportContextValue {
  openReports: ReportState[];
  setOpenReports: Dispatch<SetStateAction<ReportState[]>>;
}
const defaultValue = {
  openReports: [],
  setOpenReports: () => {
    throw new Error("ReportContextProvider value not set");
  },
};
const ReportContext = createContext<ReportContextValue>(defaultValue);

export default function ReportContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<ReportContextValue>(defaultValue);
  const { data } = useProjectMetadataQuery({
    variables: {
      slug: getSlug(),
    },
  });
  const value = useMemo(() => {
    const setOpenReports = (
      reports: ReportState[] | SetStateAction<ReportState[]>
    ) => {
      if (typeof reports === "function") {
        reports = reports(state.openReports);
      }
      setState((prev) => ({
        ...prev,
        openReports: reports as ReportState[],
      }));
    };
    return {
      ...state,
      setOpenReports,
    };
  }, [setState, state]);

  const onRequestReportClose = useCallback(
    (id: number) => {
      value.setOpenReports((prev) => prev.filter((i) => i.sketchId !== id));
    },
    [value]
  );

  return (
    <ReportContext.Provider value={value}>
      {children}
      {state.openReports.map(({ sketchId, uiState, sketchClassId }) => (
        <SketchReportWindow
          key={sketchId}
          sketchId={sketchId}
          sketchClassId={sketchClassId}
          onRequestClose={onRequestReportClose}
          uiState={uiState}
          selected={false}
          // selected={selectedIds.indexOf(`Sketch:${sketchId}`) !== -1}
          reportingAccessToken={data?.project?.sketchGeometryToken}
          // onClick={onReportClick}
        />
      ))}
    </ReportContext.Provider>
  );
}

export function useOpenReports() {
  const context = useContext(ReportContext);
  return context;
}
