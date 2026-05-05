import {
  MutableRefObject,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
// react-scripts@4 / webpack 4 does not resolve react-to-print v3's package.json "exports"
// (there is no "main"); import the published CJS bundle explicitly.
import { useReactToPrint } from "react-to-print/dist/react-to-print.js";
import { useTranslation } from "react-i18next";
import { FormLanguageContext } from "../formElements/FormElement";
import { ReportTabConfiguration } from "./cards/cards";
import { useBaseReportContext } from "./context/BaseReportContext";
import { ReportUIStateContext } from "./context/ReportUIStateContext";
import { useSubjectReportContext } from "./context/SubjectReportContext";
import { ReportCardWithToolbarContext } from "./SortableReportContent";
import { REACT_PRINT_PAGE_STYLE } from "./reactPrintPageStyle";

export type ReportPrintControlsRef = MutableRefObject<{
  runPrint: () => void;
} | null>;

function localizedTabTitle(
  tab: ReportTabConfiguration,
  langCode: string
): string {
  if (langCode !== "EN" && tab.alternateLanguageSettings) {
    const alternateSettings = tab.alternateLanguageSettings[langCode];
    if (alternateSettings?.title) {
      return alternateSettings.title as string;
    }
  }
  return tab.title;
}

/**
 * Renders an off-screen duplicate of every report tab and card for react-to-print,
 * without expanding the on-screen report (nested provider forces `printing` only here).
 */
export default function ReportFullPrintBridge({
  controlsRef,
  adminModeForCards,
}: {
  controlsRef: ReportPrintControlsRef;
  adminModeForCards: boolean;
}) {
  const { report } = useBaseReportContext();
  const uiState = useContext(ReportUIStateContext);
  const langContext = useContext(FormLanguageContext);
  const subjectReportContext = useSubjectReportContext();
  const { t } = useTranslation("admin:sketching");
  const [mountPrintLayout, setMountPrintLayout] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const noopSetEditing = useCallback(
    (_editing: number | null, _preselectTitle?: boolean) => {},
    []
  );

  const langCode = langContext?.lang?.code ?? "EN";

  const sortedTabs = useMemo(
    () => [...(report.tabs || [])].sort((a, b) => a.position - b.position),
    [report.tabs]
  );

  const hasMultipleTabs = (report.tabs || []).length > 1;

  const printSurfaceContextValue = useMemo(
    () => ({ ...uiState, printing: true }),
    [uiState]
  );

  const documentTitle = useMemo(() => {
    const sketchName = subjectReportContext.data?.sketch?.name;
    if (sketchName) {
      return sketchName;
    }
    return t("Sketch report");
  }, [subjectReportContext.data?.sketch?.name, t]);

  const reactToPrintFn = useReactToPrint({
    contentRef,
    documentTitle,
    pageStyle: REACT_PRINT_PAGE_STYLE,
    onAfterPrint: () => {
      setMountPrintLayout(false);
    },
    onPrintError: () => {
      setMountPrintLayout(false);
    },
  });

  const runPrint = useCallback(() => {
    if (!report.tabs?.length) {
      return;
    }
    setMountPrintLayout(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void reactToPrintFn();
      });
    });
  }, [report.tabs?.length, reactToPrintFn]);

  useLayoutEffect(() => {
    controlsRef.current = { runPrint };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, runPrint]);

  return (
    <div
      ref={contentRef}
      className="pointer-events-none absolute left-0 top-0 z-[2147483646] box-border w-full overflow-visible bg-white text-black"
      aria-hidden
    >
      {mountPrintLayout && (
        <ReportUIStateContext.Provider value={printSurfaceContextValue}>
          <div className="report-print-root box-border w-full bg-white p-0 text-sm text-black">
            <header className="mb-6 border-b border-black/15 pb-4">
              <h1 className="text-2xl font-bold text-black">
                {subjectReportContext.data?.sketch?.name ?? t("Sketch report")}
              </h1>
            </header>
            {sortedTabs.map((tab) => {
              const sortedCards = [...(tab.cards || [])].sort(
                (a, b) => a.position - b.position
              );
              return (
                <section
                  key={tab.id}
                  className="report-print-tab mb-10 last:mb-0"
                >
                  <h2 className="mb-4 border-b border-black/20 pb-2 text-lg font-semibold text-black">
                    {localizedTabTitle(tab, langCode)}
                  </h2>
                  <div className="flex flex-col gap-4">
                    {sortedCards.map((card) => (
                      <ReportCardWithToolbarContext
                        key={`print-${tab.id}-${card.id}`}
                        card={card}
                        hasMultipleTabs={hasMultipleTabs}
                        adminMode={adminModeForCards}
                        setEditing={noopSetEditing}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </ReportUIStateContext.Provider>
      )}
    </div>
  );
}
