import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { ChevronLeftIcon, PencilIcon } from "@heroicons/react/outline";
import { Link } from "react-router-dom";
import { useSurveyByIdQuery } from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import SurveyDraftControl from "./SurveyDraftControl";
import { useState } from "react";
import ResponseGrid, { ResponseGridTabName } from "./ResponseGrid";
import { ErrorBoundary } from "@sentry/react";
import ErrorBoundaryFallback from "../../components/ErrorBoundaryFallback";

export default function SurveyDetail({ surveyId }: { surveyId: number }) {
  const [highlighedRows, setHighlightedRows] = useState<number[]>([]);
  const [selection, setSelection] = useState<number[]>([]);
  const [tab, setTab] = useState<ResponseGridTabName>("responses");
  const { t } = useTranslation("admin:surveys");
  const { data, loading } = useSurveyByIdQuery({
    variables: {
      id: surveyId,
    },
  });
  const [mapTileCacheBuster, setCacheBuster] = useState(new Date().getTime());
  const survey = data?.survey;
  return (
    <div className="flex flex-col min-h-full max-h-full">
      <div className="">
        <nav
          className="flex items-start px-4 py-3 sm:px-6 lg:px-8"
          aria-label="Breadcrumb"
        >
          <Link
            to="./"
            className="inline-flex items-center space-x-3 text-sm font-medium text-gray-500"
          >
            <ChevronLeftIcon
              className="-ml-2 h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
            <span>{t("Survey List")}</span>
          </Link>
        </nav>
        {survey && (
          <>
            <h1 className="text-gray-900 text-3xl font-bold px-4 py-1 sm:px-6 lg:px-8">
              {survey.name}
              <Button
                className="ml-4"
                href={`../../survey-editor/${data.survey?.id}`}
                label={
                  <>
                    <PencilIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                    {t("Edit Form")}
                  </>
                }
              />
            </h1>
            <div className="px-4 py-1 sm:px-6 lg:px-8">
              {data?.survey && <SurveyDraftControl id={data.survey.id} />}
            </div>
          </>
        )}
      </div>
      {data?.survey?.isSpatial &&
        Boolean(data?.survey?.submittedResponseCount) && (
          <div className="h-72 flex-shrink-0 relative flex items-center justify-center">
            <span className="p-5 border-4 border-dashed">
              <Trans ns="admin:surveys">Map temporarily disabled</Trans>
            </span>
            {/* <ResponsesMap
              mapTileCacheBuster={mapTileCacheBuster}
              selection={selection}
              onClickResponses={setHighlightedRows}
              surveyId={surveyId}
              filter={tab}
            /> */}
          </div>
        )}
      <ErrorBoundary
        fallback={
          <ErrorBoundaryFallback title={t("Failed to render responses grid")} />
        }
      >
        {Boolean(data?.survey?.submittedResponseCount) ? (
          <ResponseGrid
            highlightedRows={highlighedRows}
            className="flex-1 bg-white"
            surveyId={surveyId}
            onSelectionChange={(selection) => setSelection(selection)}
            onTabChange={(tab) => setTab(tab)}
            onNewMapTilesRequired={() => setCacheBuster(new Date().getTime())}
          />
        ) : loading ? (
          <Spinner />
        ) : (
          <div>
            <div className="border-4 border-dashed border-gray-300 text-gray-500 w-72 rounded p-4 text-center ml-8 mt-8">
              <Trans ns="admin:surveys">No responses yet for this survey</Trans>
            </div>
          </div>
        )}
      </ErrorBoundary>
      {!survey && <Spinner />}
    </div>
  );
}
