import { XIcon } from "@heroicons/react/outline";
import { useContext, useMemo } from "react";
import Skeleton from "../../components/Skeleton";
import {
  SketchingDetailsFragment,
  useSketchReportingDetailsQuery,
} from "../../generated/graphql";
import useAccessToken from "../../useAccessToken";
import { useTranslation } from "react-i18next";
import { MapContext } from "../../dataLayers/MapContextManager";
import languages from "../../lang/supported";
import { getSelectedLanguage } from "../../surveys/LanguageSelector";
import { ReportWindowUIState } from "./LegacySketchReportWindow";
import { FormLanguageContext } from "../../formElements/FormElement";
import { ReportContext, useReportState } from "../../reports/ReportContext";
import { ReportTabs } from "../../reports/ReportTabs";
import { ReportConfiguration } from "../../reports/cards/cards";
import { ReportBody } from "../../reports/ReportBody";
import { registerCards } from "../../reports/cards/cards";

registerCards();

export default function SketchReportWindow({
  sketchId,
  sketchClassId,
  uiState,
  selected,
  onRequestClose,
  reportingAccessToken,
  onClick,
}: {
  sketchClassId: number;
  sketchId: number;
  uiState: ReportWindowUIState;
  selected: boolean;
  onRequestClose: (id: number) => void;
  reportingAccessToken?: string | null;
  onClick?: (metaKey: boolean, id: number) => void;
}) {
  const mapContext = useContext(MapContext);
  const token = useAccessToken();
  const { data, loading } = useSketchReportingDetailsQuery({
    variables: {
      id: sketchId,
      sketchClassId: sketchClassId,
    },
    fetchPolicy: "cache-first",
  });

  const {
    selectedTabId,
    setSelectedTabId,
    selectedTab,
    selectedForEditing,
    setSelectedForEditing,
  } = useReportState((data?.sketchClass?.report as any) || undefined);

  const filteredLanguages = useMemo(
    () =>
      languages.filter(
        (f) =>
          !data?.sketchClass?.project?.supportedLanguages ||
          data?.sketchClass?.project?.supportedLanguages.find(
            (o) => o === f.code
          ) ||
          f.code === "EN"
      ),
    [data?.sketchClass?.project?.supportedLanguages, languages]
  );

  const { i18n } = useTranslation();
  const lang = getSelectedLanguage(i18n, filteredLanguages);

  return (
    <FormLanguageContext.Provider
      value={{
        lang: lang.selectedLang,
        setLanguage: (code: string) => {
          const lang = languages.find((lang) => lang.code === code);
          if (!lang) {
            throw new Error(`Unrecognized language ${code}`);
          }
          i18n.changeLanguage(lang.code);
        },
        supportedLanguages: filteredLanguages.map((l) => l.code),
      }}
    >
      <div
        className="flex-none flex flex-col bg-white rounded overflow-hidden w-128 shadow-lg pointer-events-auto"
        style={{ maxHeight: 1024 }}
        onClick={(e) => {
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
            {loading && !data?.sketch?.name ? (
              <Skeleton className="h-5 w-36" />
            ) : (
              data?.sketch?.name
            )}
          </h1>
          <button
            autoFocus
            className="hover:bg-gray-100 rounded-full p-2 -mr-2"
            onClick={() => onRequestClose(sketchId)}
          >
            <XIcon className="w-5 h-5 text-black" />
          </button>
        </div>
        {data?.sketchClass?.report && data?.sketch && (
          <ReportContext.Provider
            value={{
              sketchClass:
                data.sketchClass as unknown as SketchingDetailsFragment,
              sketch: data.sketch,
              report: data?.sketchClass
                ?.report as unknown as ReportConfiguration,
              setSelectedTabId: setSelectedTabId,
              selectedTabId,
              selectedTab,
              selectedForEditing,
              setSelectedForEditing,
              adminMode: false,
            }}
          >
            <>
              <ReportTabs />
              <div
                className="flex-1 overflow-x-hidden overflow-y-auto"
                style={{ backgroundColor: "#efefef" }}
              >
                <ReportBody />
              </div>
            </>
          </ReportContext.Provider>
        )}
      </div>
    </FormLanguageContext.Provider>
  );
}
