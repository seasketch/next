import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import useProjectId from "../../useProjectId";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  ChevronLeftIcon,
  LinkIcon,
  PencilIcon,
} from "@heroicons/react/outline";
import { Link } from "react-router-dom";
import { useSurveyByIdQuery } from "../../generated/graphql";
import Spinner from "../../components/Spinner";
import SurveyDraftControl from "./SurveyDraftControl";
import { useMemo } from "react";
import ResponseGrid from "./ResponseGrid";
import ResponsesMap from "./ResponsesMap";
import { ErrorBoundary } from "@sentry/react";
import ErrorBoundaryFallback from "../../components/ErrorBoundaryFallback";

export default function SurveyDetail({ surveyId }: { surveyId: number }) {
  const projectId = useProjectId();
  const { t } = useTranslation("admin:surveys");
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useSurveyByIdQuery({
    variables: {
      id: surveyId,
    },
  });
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
      {data?.survey?.isSpatial && (
        <div className="h-72 flex-shrink-0 relative">
          <ResponsesMap surveyId={surveyId} />
        </div>
      )}
      <ErrorBoundary
        fallback={
          <ErrorBoundaryFallback title={t("Failed to render responses grid")} />
        }
      >
        <ResponseGrid className="flex-1 bg-white" surveyId={surveyId} />
      </ErrorBoundary>
      {!survey && <Spinner />}
    </div>
  );
}
