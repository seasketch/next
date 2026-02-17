import { XIcon } from "@heroicons/react/outline";
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Skeleton from "../../components/Skeleton";
import { useTranslation } from "react-i18next";
import languages from "../../lang/supported";
import { getSelectedLanguage } from "../../surveys/LanguageSelector";
import { ReportWindowUIState } from "./LegacySketchReportWindow";
import { FormLanguageContext } from "../../formElements/FormElement";
import { ReportTabs } from "../../reports/ReportTabs";
import { ReportBody } from "../../reports/ReportBody";
import { useCalculationDetailsModalState } from "../../reports/components/CalculationDetailsModal";
import { ReportUIStateContext } from "../../reports/context/ReportUIStateContext";
import {
  BaseReportContext,
  BaseReportContextProvider,
} from "../../reports/context/BaseReportContext";
import ReportDependenciesContextProvider from "../../reports/context/ReportDependenciesContext";
import {
  SubjectReportContext,
  SubjectReportContextProvider,
} from "../../reports/context/SubjectReportContext";
// import { registerCards } from "../../reports/cards/cards";

// registerCards();

const noop = () => {};
function SketchReportWindow({
  sketchId,
  sketchClassId,
  reportId,
  uiState,
  selected,
  onRequestClose,
  reportingAccessToken,
  onClick,
}: {
  sketchClassId: number;
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
      <BaseReportContextProvider sketchClassId={sketchClassId} draft={false}>
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
  const [selectedTabId, setSelectedTabId] = useState<number | undefined>(
    baseReportContext.data?.report?.tabs?.[0]?.id ?? undefined
  );

  useEffect(() => {
    if (baseReportContext.data?.report?.tabs && selectedTabId === undefined) {
      setSelectedTabId(baseReportContext.data.report.tabs[0].id);
    }
  }, [baseReportContext.data?.report?.tabs, setSelectedTabId, selectedTabId]);

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
    };
  }, [
    selectedTabId,
    calcDetailsModalState,
    setSelectedTabId,
    setShowCalcDetails,
  ]);

  // Wait for BaseReportContext data to be ready before rendering
  if (baseReportContext.loading || !baseReportContext.data) {
    return null;
  }

  return (
    <ReportDependenciesContextProvider sketchId={sketchId} reportId={reportId}>
      <SubjectReportContextProvider sketchId={sketchId}>
        <ReportUIStateContext.Provider value={uiStateContextValue}>
          <div
            className="flex-none flex flex-col bg-white rounded overflow-hidden w-128 shadow-lg pointer-events-auto"
            style={{ maxHeight: 1024 }}
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
            <div className="p-4 border-b flex items-center">
              <h1 className="flex-1 truncate text-lg">
                <ReportTitle />
              </h1>
              <button
                autoFocus
                className="hover:bg-gray-100 rounded-full p-2 -mr-2"
                onClick={() => onRequestClose(sketchId)}
              >
                <XIcon className="w-5 h-5 text-black" />
              </button>
            </div>
            <ReportTabs />
            <div
              className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
              style={{ backgroundColor: "#efefef" }}
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
