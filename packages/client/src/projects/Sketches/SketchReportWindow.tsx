import { XIcon } from "@heroicons/react/outline";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Skeleton from "../../components/Skeleton";
import { useTranslation } from "react-i18next";
import languages from "../../lang/supported";
import { getSelectedLanguage } from "../../surveys/LanguageSelector";
import { ReportWindowUIState } from "./LegacySketchReportWindow";
import { FormLanguageContext } from "../../formElements/FormElement";
import ReportFullPrintBridge from "../../reports/ReportFullPrintBridge";
import { ReportTabs } from "../../reports/ReportTabs";
import { ReportBody } from "../../reports/ReportBody";
import { useCalculationDetailsModalState } from "../../reports/components/CalculationDetailsModal";
import { ReportUIStateContext } from "../../reports/context/ReportUIStateContext";
import {
  BaseReportContext,
  BaseReportContextProvider,
} from "../../reports/context/BaseReportContext";
import ReportDependenciesContextProvider from "../../reports/context/ReportDependenciesContext";
import ReportPublishedMetricDependenciesRegistrar from "../../reports/context/ReportPublishedMetricDependenciesRegistrar";
import {
  SubjectReportContext,
  SubjectReportContextProvider,
} from "../../reports/context/SubjectReportContext";
import { ReportDependenciesContext } from "../../reports/context/ReportDependenciesContext";
import { useSubjectReportContextQuery } from "../../generated/graphql";
import {
  collectCardExportSections,
  packageSectionsAsCsvBlob,
} from "../../reports/widgets/exports";
import { collectReportCardTitle } from "../../admin/sketchClasses/SketchClassReportsAdmin";
import { download } from "../../download";
// import { registerCards } from "../../reports/cards/cards";

// registerCards();

const noop = () => {};
function SketchReportWindow({
  sketchId,
  reportId,
  uiState,
  selected,
  onRequestClose,
  reportingAccessToken,
  onClick,
}: {
  sketchId: number;
  reportId: number;
  uiState: ReportWindowUIState;
  selected: boolean;
  onRequestClose: (id: number) => void;
  reportingAccessToken?: string | null;
  onClick?: (metaKey: boolean, id: number) => void;
}) {
  const { i18n } = useTranslation();
  const lang = getSelectedLanguage(i18n, languages);

  // Memoize FormLanguageContext value to prevent unnecessary re-renders of report
  // widgets (e.g. OverlappingAreasTable) when parent re-renders for unrelated
  // reasons (e.g. map sketch selection changes). Without this, the inline object
  // creates a new reference every render, causing all context consumers to re-render.
  const setFormLanguage = useCallback(
    (code: string) => {
      const found = languages.find((l) => l.code === code);
      if (!found) {
        throw new Error(`Unrecognized language ${code}`);
      }
      i18n.changeLanguage(found.code);
    },
    [i18n]
  );

  const formLanguageContextValue = useMemo(
    () => ({
      lang: lang.selectedLang,
      setLanguage: setFormLanguage,
      supportedLanguages: languages.map((l) => l.code),
    }),
    [lang.selectedLang, setFormLanguage]
  );

  return (
    <FormLanguageContext.Provider value={formLanguageContextValue}>
      <BaseReportContextProvider reportId={reportId}>
        <SketchReportWindowInner
          sketchId={sketchId}
          reportId={reportId}
          onClick={onClick}
          onRequestClose={onRequestClose}
        />
      </BaseReportContextProvider>
    </FormLanguageContext.Provider>
  );
}

export default memo(SketchReportWindow);

function SketchReportWindowInner({
  sketchId,
  reportId,
  onClick,
  onRequestClose,
}: {
  sketchId: number;
  reportId: number;
  onClick?: (metaKey: boolean, id: number) => void;
  onRequestClose: (id: number) => void;
}) {
  const calcDetailsModalState = useCalculationDetailsModalState();
  const { closeModal, openModal } = calcDetailsModalState;
  const baseReportContext = useContext(BaseReportContext);
  const baseReady =
    !baseReportContext.loading && Boolean(baseReportContext.data);

  const { data: subjectQueryData, loading: subjectQueryLoading } =
    useSubjectReportContextQuery({
      variables: { sketchId },
      skip: !baseReady,
    });

  useEffect(() => {
    if (
      subjectQueryLoading ||
      !subjectQueryData ||
      subjectQueryData.sketch != null
    ) {
      return;
    }
    onRequestClose(sketchId);
  }, [subjectQueryLoading, subjectQueryData, sketchId, onRequestClose]);

  const [selectedTabId, setSelectedTabId] = useState<number | undefined>(
    baseReportContext.data?.report?.tabs?.[0]?.id ?? undefined
  );

  useEffect(() => {
    if (baseReportContext.data?.report?.tabs && selectedTabId === undefined) {
      setSelectedTabId(baseReportContext.data.report.tabs[0].id);
    }
  }, [baseReportContext.data?.report?.tabs, setSelectedTabId, selectedTabId]);

  const reportBodyScrollRef = useRef<HTMLDivElement>(null);
  const reportPrintControlsRef = useRef<{ runPrint: () => void } | null>(null);

  useLayoutEffect(() => {
    const el = reportBodyScrollRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [selectedTabId]);

  const setShowCalcDetails = useCallback(
    (cardId: number | undefined) => {
      if (!cardId) {
        closeModal();
      } else {
        openModal(cardId);
      }
    },
    [closeModal, openModal]
  );

  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const onBeforePrint = () => setPrinting(true);
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const requestFullReportPrint = useCallback(() => {
    reportPrintControlsRef.current?.runPrint();
  }, []);

  const uiStateContextValue = useMemo(() => {
    return {
      selectedTabId: selectedTabId,
      setSelectedTabId: setSelectedTabId,
      editing: null,
      setEditing: noop,
      adminMode: false,
      preselectTitle: false,
      showCalcDetails: calcDetailsModalState.state.cardId ?? undefined,
      setShowCalcDetails: setShowCalcDetails,
      printing,
      setPrinting,
      requestFullReportPrint,
    };
  }, [
    selectedTabId,
    calcDetailsModalState,
    setSelectedTabId,
    setShowCalcDetails,
    printing,
    requestFullReportPrint,
  ]);

  // Wait for BaseReportContext data to be ready before rendering
  if (baseReportContext.loading || !baseReportContext.data) {
    return null;
  }

  return (
    <ReportDependenciesContextProvider sketchId={sketchId} reportId={reportId}>
      <ReportPublishedMetricDependenciesRegistrar />
      <SubjectReportContextProvider sketchId={sketchId}>
        <ReportUIStateContext.Provider value={uiStateContextValue}>
          <ReportFullPrintBridge
            controlsRef={reportPrintControlsRef}
            adminModeForCards={false}
          />
          <div
            className="flex-none flex flex-col  rounded overflow-hidden w-128 shadow-lg pointer-events-auto bg-gray-100"
            style={{
              maxHeight: "min(calc(100vh - 70px), 1024px)",
            }}
            onClick={(e) => {
              // Don't intercept clicks on links - let them work normally
              const link = (e.target as HTMLElement)?.closest("a");
              if (link) {
                return;
              }
              if (onClick) {
                e.stopPropagation();
                e.preventDefault();
                e.nativeEvent.stopImmediatePropagation();
                e.nativeEvent.preventDefault();
                onClick(e.metaKey, sketchId);
                return false;
              }
            }}
          >
            <div className="p-4 border-b flex items-center bg-white gap-2">
              <h1 className="flex-1 truncate text-lg">
                <ReportTitle />
              </h1>
              <ReportWindowActionsMenu onPrint={requestFullReportPrint} />
              <button
                autoFocus
                type="button"
                className="hover:bg-gray-100 rounded-full p-2 -mr-2 flex-shrink-0"
                onClick={() => onRequestClose(sketchId)}
              >
                <XIcon className="w-5 h-5 text-black" />
              </button>
            </div>
            <ReportTabs />
            <div
              ref={reportBodyScrollRef}
              className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-gray-100"
            >
              <ReportBody />
            </div>
          </div>
        </ReportUIStateContext.Provider>
      </SubjectReportContextProvider>
    </ReportDependenciesContextProvider>
  );
}

function ReportTitle() {
  const subjectContext = useContext(SubjectReportContext);
  if (subjectContext.data?.sketch?.name) {
    return <span>{subjectContext.data.sketch.name}</span>;
  } else {
    return <Skeleton className="h-5 w-36" />;
  }
}

function slugifyFilenamePart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function ReportWindowActionsMenu({ onPrint }: { onPrint: () => void }) {
  const { t } = useTranslation("admin:sketching");
  const base = useContext(BaseReportContext);
  const subject = useContext(SubjectReportContext);
  const deps = useContext(ReportDependenciesContext);

  const reportDataReady =
    !!base.data &&
    !!subject.data &&
    !deps.loading &&
    !deps.dependenciesAwaitingRefresh;

  const exportReport = useCallback(
    async (format: "csv" | "json") => {
      if (!base.data || !subject.data) {
        return;
      }
      const sketchClassForExport = subject.data.sketch.sketchClass;
      if (!sketchClassForExport) {
        return;
      }

      const metricById = new Map(deps.metrics.map((m) => [m.id, m]));
      const sourceByStableId = new Map(
        deps.overlaySources
          .filter((s) => !!s.stableId)
          .map((s) => [s.stableId as string, s])
      );

      const sections: ReturnType<typeof collectCardExportSections> = [];
      const cards: Array<{
        tabId: number;
        tabTitle: string;
        cardId: number;
        cardTitle: string;
        sections: ReturnType<typeof collectCardExportSections>;
      }> = [];

      const sortedTabs = [...(base.data.report.tabs || [])].sort(
        (a, b) => a.position - b.position
      );

      for (const tab of sortedTabs) {
        const sortedCards = [...(tab.cards || [])].sort(
          (a, b) => a.position - b.position
        );
        for (const card of sortedCards) {
          const list = deps.cardDependencyLists.find(
            (l) => l.cardId === card.id
          );
          const cardMetrics = (list?.metrics || [])
            .map((metricId) => metricById.get(metricId))
            .filter((m): m is NonNullable<typeof m> => m != null);
          const cardSources = (list?.overlaySources || [])
            .map((stableId) => sourceByStableId.get(stableId))
            .filter((s): s is NonNullable<typeof s> => s != null);
          const cardTitle =
            collectReportCardTitle(card.body) || `${t("Card")} ${card.id}`;
          const cardSections = collectCardExportSections({
            reportId: base.data.report.id,
            cardId: card.id,
            cardTitle,
            body: card.body as any,
            metrics: cardMetrics,
            sources: cardSources,
            geographies: base.data.geographies,
            sketchClass: sketchClassForExport,
            subject: {
              sketchId: subject.data.sketch.id,
              sketchName: subject.data.sketch.name,
              isCollection: subject.data.isCollection,
              childSketches: (subject.data.childSketches || []).map((c) => ({
                id: c.id,
                name: c.name,
              })),
            },
            relatedFragments: (subject.data.relatedFragments || []).map(
              (f) => ({
                hash: f.hash,
                geographies: f.geographies,
                sketches: f.sketches,
              })
            ),
            primaryGeographyId: undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            t: ((k: string) => k) as any,
          });

          sections.push(
            ...cardSections.map((section, index) => ({
              ...section,
              // File identity for CSV zip packaging: lead with card/widget, suffix ids for uniqueness.
              /* eslint-disable i18next/no-literal-string */
              id:
                `${slugifyFilenamePart(cardTitle) || "card"}-` +
                `${slugifyFilenamePart(section.title) || "section"}-` +
                `t${tab.id}-c${card.id}-s${index + 1}`,
              /* eslint-enable i18next/no-literal-string */
              // Human-readable title in manifest/json: card title first, then widget title.
              // eslint-disable-next-line i18next/no-literal-string
              title:
                `${cardTitle} / ${section.title}` +
                ` (${t("Tab")} ${tab.id}, ${t("Card")} ${card.id}, ${t(
                  "Section"
                )} ${index + 1})`,
            }))
          );
          cards.push({
            tabId: tab.id,
            tabTitle: tab.title,
            cardId: card.id,
            cardTitle,
            sections: cardSections,
          });
        }
      }

      const filenameBase =
        // eslint-disable-next-line i18next/no-literal-string
        `${subject.data.sketch.id}-` +
        `${
          slugifyFilenamePart(subject.data.sketch.name) ||
          subject.data.sketch.id
        }` +
        // eslint-disable-next-line i18next/no-literal-string
        `-report-${base.data.report.id}`;

      if (format === "json") {
        const body = {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          format: "seasketch-report-export",
          meta: {
            reportId: base.data.report.id,
            subjectSketchId: subject.data.sketch.id,
            subjectSketchName: subject.data.sketch.name,
            isCollection: subject.data.isCollection,
          },
          cards,
        };
        const blob = new Blob([JSON.stringify(body, null, 2)], {
          // eslint-disable-next-line i18next/no-literal-string
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        // eslint-disable-next-line i18next/no-literal-string
        download(url, `${filenameBase}.json`);
        URL.revokeObjectURL(url);
        return;
      }

      const { blob } = await packageSectionsAsCsvBlob(sections);
      const url = URL.createObjectURL(blob);
      // eslint-disable-next-line i18next/no-literal-string
      download(url, `${filenameBase}.zip`);
      URL.revokeObjectURL(url);
    },
    [
      base.data,
      subject.data,
      deps.metrics,
      deps.overlaySources,
      deps.cardDependencyLists,
      t,
    ]
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex-shrink-0 p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-black/5"
          aria-label={t("Report actions")}
          title={t("Report actions")}
        >
          <DotsHorizontalIcon className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 min-w-[180px] rounded-md border border-black/5 bg-white p-1 shadow-lg"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none text-gray-700 data-[highlighted]:bg-gray-100"
            onSelect={() => onPrint()}
          >
            {t("Print report")}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-black/10" />
          <DropdownMenu.Item
            disabled={!reportDataReady}
            className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none text-gray-700 data-[highlighted]:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
            onSelect={() => void exportReport("csv")}
          >
            {t("Export results (CSV)")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!reportDataReady}
            className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm outline-none text-gray-700 data-[highlighted]:bg-gray-100 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
            onSelect={() => void exportReport("json")}
          >
            {t("Export results (JSON)")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
