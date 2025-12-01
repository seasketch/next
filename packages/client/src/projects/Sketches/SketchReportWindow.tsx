import { XIcon } from "@heroicons/react/outline";
import { useMemo } from "react";
import Skeleton from "../../components/Skeleton";
import { useSketchReportingDetailsQuery } from "../../generated/graphql";
import { useTranslation } from "react-i18next";
import languages from "../../lang/supported";
import { getSelectedLanguage } from "../../surveys/LanguageSelector";
import { ReportWindowUIState } from "./LegacySketchReportWindow";
import { FormLanguageContext } from "../../formElements/FormElement";
import { ReportContext, useReportState } from "../../reports/ReportContext";
import { ReportTabs } from "../../reports/ReportTabs";
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
  const { data, loading } = useSketchReportingDetailsQuery({
    variables: {
      id: sketchId,
      sketchClassId: sketchClassId,
    },
    fetchPolicy: "cache-first",
  });

  const reportState = useReportState(
    (data?.sketchClass?.report?.id as number) || undefined,
    data?.sketchClass?.id || 0,
    data?.sketch?.id || 0
  );

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
    [data?.sketchClass?.project?.supportedLanguages]
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
        {reportState && (
          <ReportContext.Provider
            value={{
              ...reportState,
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
