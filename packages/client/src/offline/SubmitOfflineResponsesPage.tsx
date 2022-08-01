/* eslint-disable i18next/no-literal-string */
import { useAuth0 } from "@auth0/auth0-react";
import { CheckIcon } from "@heroicons/react/outline";
import { CheckCircleIcon } from "@heroicons/react/solid";
import { useCallback, useContext, useMemo, useState } from "react";
import { Trans as T } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import CenteredCardListLayout, {
  Card,
  Header,
} from "../components/CenteredCardListLayout";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import SignedInAs from "../components/SignedInAs";
import Spinner from "../components/Spinner";
import Warning from "../components/Warning";
import {
  useCreateResponseMutation,
  useSurveysByIdQuery,
} from "../generated/graphql";
import { OfflineStateContext } from "./OfflineStateContext";
import useOfflineSurveyResponses from "./useOfflineSurveyResponses";

const Trans = (props: any) => (
  <T ns="offline" {...props}>
    {props.children}
  </T>
);

export default function SubmitOfflineResponsesPage() {
  const { online } = useContext(OfflineStateContext);
  const { responses, removeResponse } = useOfflineSurveyResponses();
  const [submissionDetails, setSubmissionDetails] = useState<{
    responses: number;
    projects: {
      id: number;
      name: string;
      surveys: { id: number; name: string; responseCount: number }[];
      slug: string;
    }[];
  }>({
    responses: 0,
    projects: [],
  });
  const { data, loading, error } = useSurveysByIdQuery({
    variables: {
      surveyIds: [...responses.map((r) => r.surveyId)],
    },
  });
  const { user, logout, loginWithRedirect } = useAuth0();
  const [mutate, mutationState] = useCreateResponseMutation();

  const responsesByProject = useMemo(() => {
    const projects: {
      name: string;
      id: number;
      slug: string;
      surveys: {
        name: string;
        id: number;
        responseCount: number;
      }[];
    }[] = [];
    if (responses.length && data?.getSurveys?.length) {
      for (const survey of data.getSurveys) {
        let project = projects.find((p) => p.id === survey.projectId);
        if (!project) {
          project = {
            id: survey.projectId,
            name: survey.project!.name,
            slug: survey.project!.slug,
            surveys: [],
          };
          projects.push(project);
        }
        project.surveys.push({
          id: survey.id,
          name: survey.name,
          responseCount: responses.filter((r) => r.surveyId === survey.id)
            .length,
        });
      }
    }
    return projects;
  }, [data, responses]);

  const onError = useGlobalErrorHandler();

  const saveResponses = useCallback(async () => {
    if (!data?.getSurveys) {
      throw new Error("Surveys have not yet been fetched");
    }
    const surveys = data.getSurveys;
    for (const response of responses) {
      const res = await mutate({
        variables: {
          bypassedDuplicateSubmissionControl: false,
          facilitated: response.facilitated,
          isDraft: false,
          practice: response.practice,
          responseData: response.responseData,
          surveyId: response.surveyId,
          offlineId: response.offlineId,
        },
        onError,
      });
      if (!res.errors?.length) {
        await removeResponse(response.offlineId);
        setSubmissionDetails((prev) => {
          const surveyDetails = surveys.find(
            (s) => s.id === response.surveyId
          )!;
          let project = prev.projects.find((p) => p.id === response.projectId);
          if (!project) {
            project = {
              id: surveyDetails.project!.id,
              name: surveyDetails.project!.name,
              slug: surveyDetails.project!.slug,
              surveys: [],
            };
            prev.projects.push(project);
          }
          let survey = project.surveys.find((s) => s.id === response.surveyId);
          if (!survey) {
            survey = {
              id: surveyDetails.id,
              name: surveyDetails.name,
              responseCount: 0,
            };
            project.surveys.push(survey);
          }
          survey.responseCount += 1;
          return {
            ...prev,
            responses: prev.responses + 1,
          };
        });
      } else {
        break;
      }
    }
  }, [data, responses, mutate, onError, removeResponse]);

  return (
    <CenteredCardListLayout>
      <Card>
        <Header>
          {responses.length !== 0 ? (
            <T i18nKey="SubmitResponsesTitle" count={responses.length}>
              Submit {{ count: responses.length }} Offline Survey Response
            </T>
          ) : (
            <Trans>Submit Offline Survey Responses</Trans>
          )}
        </Header>
        {online && (
          <>
            <p className="text-sm text-gray-500 mt-1">
              <Trans>
                Survey responses collected while offline are stored in your
                browser cache and can be submitted to the SeaSketch server now
                that you are online.{" "}
              </Trans>
            </p>
            {!loading &&
              data?.me &&
              (responses.length > 0 || submissionDetails.responses > 0) && (
                <p className="text-sm text-gray-500 mt-1">
                  <Trans>
                    Responses you submit will be associated with the account
                    listed below. If this is not correct, please{" "}
                    <button
                      className="underline"
                      onClick={() =>
                        logout({
                          returnTo:
                            window.location.protocol +
                            "//" +
                            window.location.host +
                            "/",
                        })
                      }
                    >
                      sign out
                    </button>{" "}
                    and login from the correct account.
                  </Trans>
                </p>
              )}
          </>
        )}
        {!online && (
          <Warning>
            <Trans>
              You will need to be connected to the internet to submit survey
              responses.
            </Trans>
          </Warning>
        )}
        {loading && (
          <div className="p-5 w-full flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {!loading && (
          <>
            {online && !data?.me && (
              <Warning>
                <Trans>
                  You will need to be signed in before submitting survey
                  responses.
                </Trans>
              </Warning>
            )}
            {online &&
              (responses.length > 0 || submissionDetails.responses > 0) && (
                <div className="flex justify-center py-5 space-x-5">
                  <SignedInAs
                    onClick={() => {
                      loginWithRedirect({
                        prompt: "login",
                        appState: {
                          returnTo: window.location.pathname,
                        },
                      });
                    }}
                    className="w-lg border p-2 rounded shadow-sm"
                  />
                  {!data?.me && (
                    <Button
                      onClick={() => {
                        loginWithRedirect({
                          prompt: "login",
                          appState: {
                            returnTo: window.location.pathname,
                          },
                        });
                      }}
                      buttonClassName="text-base"
                      label={<Trans>Sign In</Trans>}
                    />
                  )}
                </div>
              )}
          </>
        )}
      </Card>
      {online && responsesByProject.length > 0 && (
        <>
          <Card className="space-y-1">
            {responsesByProject.length > 0 &&
              responsesByProject.map((project) => (
                <div key={project.id}>
                  <h3 className="text-base font-semibold">{project.name}</h3>
                  <ul className="space-y-1 my-2">
                    {project.surveys.map((s) => (
                      <li className="p-2 bg-gray-50 flex" key={s.id}>
                        <div className="flex-1 truncate">{s.name}</div>
                        <div className="px-4 rounded-full bg-primary-500 bg-opacity-10">
                          {s.responseCount}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {data?.me && (
              <div className="w-full flex justify-center items-center pt-2">
                <Button
                  onClick={saveResponses}
                  loading={mutationState.loading}
                  disabled={mutationState.loading}
                  primary
                  label={<Trans>Submit Responses</Trans>}
                />
              </div>
            )}
          </Card>
        </>
      )}
      {submissionDetails.responses > 0 && responses.length === 0 && (
        <>
          <Card>
            <Header>
              <Trans
                ns={undefined}
                i18nKey="ResponsesSubmitted"
                count={submissionDetails.responses}
              >
                Submitted {{ count: submissionDetails.responses }} Responses
              </Trans>
            </Header>
            <p className="text-sm text-gray-500 mt-1">
              <Trans>
                All your offline work is now saved to the SeaSketch database.
                You can now close the browser window, or use the links below to
                navigate back to your surveys and projects.
              </Trans>
            </p>
            <div className="mt-2">
              {submissionDetails.projects.map((project) => (
                <div key={project.id}>
                  <h3 className="text-base font-semibold ">
                    <Link to={`/${project.slug}`}>{project.name}</Link>
                  </h3>
                  <ul className="space-y-1 my-2">
                    {project.surveys.map((s) => (
                      <Link
                        to={`/${project.slug}/surveys/${s.id}`}
                        className="p-2 bg-gray-50 flex"
                        key={s.id}
                      >
                        <div className="flex-1 truncate">{s.name}</div>
                        <CheckCircleIcon className="w-5 h-5 text-green-800" />
                      </Link>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
          <div className="w-full flex justify-center items-center pt-2">
            <Button
              disabled={true}
              label={
                <>
                  <Trans>All responses submitted</Trans>{" "}
                  <CheckIcon className="w-5 h-5 inline ml-2" />
                </>
              }
            />
          </div>
        </>
      )}
      {responses.length === 0 && submissionDetails.responses === 0 && (
        <div className="w-full flex justify-center items-center pt-2">
          <Button
            disabled={true}
            label={
              <>
                <Trans>No offline responses to submit</Trans>{" "}
                <CheckIcon className="w-5 h-5 inline ml-2" />
              </>
            }
          />
        </div>
      )}
    </CenteredCardListLayout>
  );
}
