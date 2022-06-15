/* eslint-disable i18next/no-literal-string */
import { CogIcon } from "@heroicons/react/solid";
import bytes from "bytes";
import { useContext, useEffect, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import Badge from "../components/Badge";
import { Card, Header } from "../components/CenteredCardListLayout";
import DropdownButton from "../components/DropdownButton";
import Spinner from "../components/Spinner";
import Warning from "../components/Warning";
import { useOfflineSurveysQuery } from "../generated/graphql";
import { CacheProgress } from "./CacheStatus";
import { ClientCacheManagerContext } from "./ClientCacheManager";

export default function OfflineSurveySelection() {
  const slug = window.location.pathname.split("/")[1];
  const context = useContext(ClientCacheManagerContext);
  const { data, loading, error } = useOfflineSurveysQuery({
    variables: { slug },
  });
  const { t } = useTranslation("offline");
  const surveys = useMemo(() => {
    if (data?.projectBySlug?.surveys) {
      return data.projectBySlug.surveys.map((s) => ({
        id: s.id,
        name: s.name,
      }));
    } else {
      return [];
    }
  }, [data?.projectBySlug?.surveys]);

  useEffect(() => {
    if (context) {
      context.updateCacheSizes();
    }
  }, []);
  return (
    <Card>
      <Header>
        <Trans ns="offline">Offline Surveys</Trans>
      </Header>
      <p className="text-gray-800 text-sm">
        <Trans ns="offline">
          SeaSketch can cache selected surveys for use offline in the field. You
          will need to make sure that Data Caching is set to "Improved
          Performance" or higher to enable this functionality.
        </Trans>
      </p>
      {context &&
      context.cacheSizes?.offlineSurveys.queries &&
      context.level.id !== "improved" &&
      context.level.id !== "max" ? (
        <Warning>
          <Trans ns="offline">
            Data Caching setting must be set higher to enable offline support.
          </Trans>
        </Warning>
      ) : null}
      {data && context?.cacheSizes ? (
        <div className="inline-block min-w-full py-2 align-middle">
          <table className="min-w-full divide-y divide-gray-300 mb-2">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="py-2 px-3 text-left text-sm font-semibold text-gray-900"
                >
                  Enable
                </th>
                <th
                  scope="col"
                  className="py-2 px-3 text-sm font-semibold text-left text-gray-900"
                >
                  Survey
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {surveys.map((survey) => (
                <tr key={survey.id}>
                  <td className="whitespace-nowrap py-4 w-10 text-sm font-medium text-gray-900 text-center">
                    <input
                      checked={
                        context.cacheSizes?.selectedSurveyIds.indexOf(
                          survey.id
                        ) !== -1
                      }
                      className="cursor-pointer"
                      type="checkbox"
                      onChange={async (e) => {
                        await context.toggleSurveyOfflineSupport(
                          survey.id,
                          slug
                        );
                        context.populateOfflineSurveyAssets(false);
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap py-4 px-3 text-sm text-gray-500">
                    {survey.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {context?.cacheSizes && (
            <div>
              <h4 className="flex items-center">
                <span className="flex-1">
                  <Trans ns="offline">Cache Status</Trans>
                </span>
                <DropdownButton
                  buttonClassName="border-0 border-opacity-0 shadow-none"
                  label={<CogIcon className="w-5 h-5 text-gray-600" />}
                  small
                  options={[
                    {
                      label: t("Clear cache"),
                      onClick: () => context?.clearOfflineSurveyAssets(),
                    },
                    {
                      label: t("Reload cache"),
                      onClick: async () => {
                        context.populateOfflineSurveyAssets(true);
                      },
                    },
                  ]}
                />
              </h4>
              <CacheProgress
                loading={context.cacheSizes.offlineSurveys.loading}
                percent={
                  context.cacheSizes.offlineSurveys.fractionCached * 100 || 0
                }
                description={
                  <div className="space-x-2">
                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="documentCount"
                        count={context.cacheSizes.offlineSurveys.documents}
                      >
                        {{
                          count: context.cacheSizes.offlineSurveys.documents,
                        }}{" "}
                        documents
                      </Trans>
                    </Badge>
                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="imageCount"
                        count={context.cacheSizes.offlineSurveys.images}
                      >
                        {{ count: context.cacheSizes.offlineSurveys.images }}{" "}
                        images
                      </Trans>
                    </Badge>

                    <Badge>
                      <Trans
                        ns="offline"
                        i18nKey="questionCount"
                        count={context.cacheSizes.offlineSurveys.questions}
                      >
                        {{
                          count: context.cacheSizes.offlineSurveys.questions,
                        }}{" "}
                        questions
                      </Trans>
                    </Badge>
                    {context.cacheSizes.offlineSurveys.bytes &&
                    context.cacheSizes.offlineSurveys.bytes > 1000 ? (
                      <Badge variant="secondary">
                        {bytes(context.cacheSizes.offlineSurveys.bytes)}
                      </Badge>
                    ) : null}
                  </div>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-center w-full">
          <Spinner />
        </div>
      )}
    </Card>
  );
}
