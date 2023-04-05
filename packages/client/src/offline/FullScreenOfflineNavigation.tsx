import { useContext, useEffect, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { OfflineStateContext } from "./OfflineStateContext";
import logo from "../header/seasketch-logo.png";
import CenteredCardListLayout, {
  Card,
} from "../components/CenteredCardListLayout";
import { offlineSurveyChoiceStrategy } from "./GraphqlQueryCache/strategies";
import { GraphqlQueryCache } from "./GraphqlQueryCache/main";
import { GraphqlQueryCacheContext } from "./GraphqlQueryCache/useGraphqlQueryCache";
import {
  ProjectMetadataFragment,
  SurveyAppSurveyFragment,
  SurveyQueryResult,
} from "../generated/graphql";
import { Link } from "react-router-dom";
import { useTranslatedProps } from "../components/TranslatedPropControl";

export default function FullScreenOfflineNavigation() {
  const { online, dismissed, dismiss } = useContext(OfflineStateContext);
  const cache = useContext(GraphqlQueryCacheContext);
  const { t, i18n } = useTranslation("offline");
  const [{ projects, surveys }, setResults] = useState<{
    projects: ProjectMetadataFragment[];
    surveys: (SurveyAppSurveyFragment & { projectId: number })[];
  }>({
    projects: [],
    surveys: [],
  });

  useEffect(() => {
    if (cache && !online) {
      getOfflineSurveyData(cache).then((results) => setResults(results));
    } else {
      setResults({ projects: [], surveys: [] });
    }
  }, [cache, online]);
  const getTranslatedProp = useTranslatedProps();

  if (online || dismissed) {
    return null;
  }
  return (
    <div className="w-full h-screen bg-gray-100 absolute top-0 overflow-y-auto">
      <CenteredCardListLayout>
        <Card>
          <div className="flex-shrink-0 flex items-center text-lg text-black ml-auto mr-auto justify-center">
            <img
              className="block w-14 h-auto filter saturate-0 opacity-80 border-4 border-dotted rounded-full p-1 mr-2"
              src={logo}
              alt={t("SeaSketch logo")}
              id="seasketch-logo"
            />
            {
              // eslint-disable-next-line
            }
            SeaSketch is Offline
          </div>
          <p className="text-gray-800 text-sm mt-5">
            <Trans ns="offline">
              It appears you don't have connection to the internet. SeaSketch
              supports offline use for the collection of survey data which you
              can submit when back online. If you don't see the project or
              survey you are looking for you will need to reconnect to the
              internet and adjust your account settings.
            </Trans>
          </p>
          <div className="space-y-3 mt-3">
            {projects.map((project) => (
              <div key={project.name}>
                <h2 className="py-2 font-medium">{project.name}</h2>
                {project.description && project.description.length > 0 && (
                  <p className="text-sm text-gray-500">
                    {getTranslatedProp("description", project)}
                  </p>
                )}
                <ul>
                  {surveys
                    .filter((s) => s.projectId === project.id)
                    .map((survey) => (
                      <li key={survey.id}>
                        <Link
                          to={`/${project.slug}/surveys/${survey.id}`}
                          className="bg-gray-100 p-4 rounded-sm my-2 block hover:bg-cool-gray-200 active:bg-blue-200"
                        >
                          {survey.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-5 mb-2 text-sm text-gray-500">
            <Trans ns="offline">
              If you are online and SeaSketch is incorrect about your network
              connection, you can{" "}
              <button onClick={dismiss} className="underline">
                proceed to the online site
              </button>
              .
            </Trans>
          </p>
        </Card>
      </CenteredCardListLayout>
    </div>
  );
}

async function getOfflineSurveyData(graphqlQueryCache: GraphqlQueryCache) {
  await graphqlQueryCache.updateStrategyArgs();
  const cachedArguments = await graphqlQueryCache.getStrategyArgs(
    offlineSurveyChoiceStrategy.key
  );
  const data: Pick<SurveyQueryResult, "data">[] = [];
  for (const args of cachedArguments || []) {
    const response = await graphqlQueryCache.getCachedResponse(
      offlineSurveyChoiceStrategy.queryName,
      args
    );
    if (response) {
      data.push(await response.json());
    }
  }
  const projects: ProjectMetadataFragment[] = [];
  const surveys: (SurveyAppSurveyFragment & { projectId: number })[] = [];
  for (const result of data) {
    const project = result.data?.currentProject;
    if (project && !projects.find((p) => p.id === project.id)) {
      projects.push(project);
    }
    const survey = result.data?.survey;
    if (survey && !surveys.find((s) => s.id === survey.id)) {
      surveys.push({
        ...survey,
        projectId: project!.id,
      });
    }
  }
  return { projects, surveys };
}
