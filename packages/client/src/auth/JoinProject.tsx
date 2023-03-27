import {
  ChatAlt2Icon,
  DocumentTextIcon,
  IdentificationIcon,
} from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import Spinner from "../components/Spinner";
import {
  ParticipationStatus,
  useJoinProjectMutation,
  useProjectMetadataLazyQuery,
  useProjectMetadataQuery,
} from "../generated/graphql";
import { useCallback, useContext, useEffect, useState } from "react";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import Warning from "../components/Warning";
import useDialog from "../components/useDialog";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";
import { strategies } from "../offline/GraphqlQueryCache/strategies";
import UserProfileForm, { useUserProfileState } from "./UserProfileForm";

export const HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY =
  "has-skipped-join-project-prompt";

export default function JoinProject() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation("joinProjectPage");
  const history = useHistory();
  const { data, loading } = useProjectMetadataQuery({
    variables: {
      slug,
    },
    fetchPolicy: "cache-and-network",
  });
  const onError = useGlobalErrorHandler();
  const [joinProject, joinProjectState] = useJoinProjectMutation({ onError });
  const [lazyProjectMetadata] = useProjectMetadataLazyQuery();
  const graphqlQueryCache = useContext(GraphqlQueryCacheContext);

  const location = new URL(window.location.toString());
  const redirectUrl =
    // eslint-disable-next-line i18next/no-literal-string
    location.searchParams.get("redirectUrl") || `/${slug}/app`;

  const profile = useUserProfileState();

  const updateProfileAndJoin = useCallback(async () => {
    if (data?.me?.id && data.project?.id) {
      const projectId = data.project.id;
      return profile.submit().then(async () => {
        await joinProject({
          variables: {
            projectId,
          },
        });
        const ProjectMetadataStrategy = strategies.find(
          (s) => s.queryName === "ProjectMetadata" && s.type === "lru"
        );
        // Update ProjectMetadata cache so that old state does not stick around
        // Otherwise, while the app may redirect to the homepage or admin dashboard normally, on
        // the next refresh the sessionParticipationStatus would be stuck to the old value.
        // This is particularly bad for admins, since a useEffect call opens an alert if the user
        // hasn't joined, which can't then be canceled by the swr strategy update
        if (ProjectMetadataStrategy && graphqlQueryCache) {
          await graphqlQueryCache.clearResponse(ProjectMetadataStrategy, {
            slug,
          });
          await lazyProjectMetadata({
            variables: {
              slug,
            },
            fetchPolicy: "network-only",
          });
        } else {
          console.warn("Could not clear ProjectMetadata cache");
        }
      });
    } else {
      throw new Error(
        "User.id and/or Project.id not set yet. Waiting for graphql query data."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data?.me?.id,
    data?.project?.id,
    profile.submit,
    joinProject,
    graphqlQueryCache,
    slug,
    lazyProjectMetadata,
  ]);

  const [submissionAttempted, setSubmissionAttempted] = useState(false);

  const hasPrivacyPolicy = false;

  const { alert } = useDialog();

  useEffect(() => {
    if (
      !submissionAttempted &&
      data?.project?.sessionParticipationStatus ===
        ParticipationStatus.ParticipantSharedProfile
    ) {
      alert(t("You are already a participant in this project")).then(() => {
        history.push(redirectUrl);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project?.sessionParticipationStatus, submissionAttempted]);

  if (loading || !data) {
    return (
      <div className="h-screen w-screen text-center flex justify-center items-center">
        <Spinner />
      </div>
    );
  }

  if (!data.projectPublicDetails) {
    return <Trans ns="joinProjectPage">Project not found</Trans>;
  }

  return (
    <div className="w-full sm:mx-auto">
      <div className="flex items-center space-x-4 text-2xl sm:text-3xl font-semibold text-center justify-center mt-5 mb-5 lg:mt-12 lg:mb-12">
        {data.projectPublicDetails.logoUrl && (
          <img
            alt="Project logo"
            src={data.projectPublicDetails.logoUrl}
            className="w-12 h-12"
          />
        )}
        <span>{data.projectPublicDetails.name}</span>
      </div>
      <div className="lg:flex lg:space-x-5 justify-center mx-auto px-0 sm:px-8 ">
        <div className="w-full lg:w-144 space-y-2 mb-5 lg:mb-0 px-4 sm:px-0">
          <h1 className="text-xl md:text-2xl font-semibold">
            <Trans ns="joinProjectPage">Join this Project</Trans>
          </h1>
          <p>
            <Trans ns="joinProjectPage">
              By becoming a participant you will gain access to features such as
              the discussion forums and your account can be given access to
              secure data layers. To join, we need your consent to share a user
              profile with the project.
            </Trans>
          </p>
          <h3 className="font-semibold text-lg">
            <Trans ns="joinProjectPage">How will my profile be used?</Trans>
          </h3>
          <ul className="list-decimal">
            <li className="flex space-x-3 py-2">
              <IdentificationIcon className="w-8 h-8 text-gray-600" />
              <span className="flex-1">
                <Trans ns="joinProjectPage">
                  Administrators will see you in a list of participants so that
                  can approve access to discussion groups and protected data
                  layers. They may also see activity summaries about
                  participants like{" "}
                  <i className="italic">
                    "these users post a lot in the forum."
                  </i>
                </Trans>
              </span>
            </li>
            <li className="flex space-x-3 py-2">
              <ChatAlt2Icon className="w-8 h-8 text-gray-600" />
              <span className="flex-1">
                <Trans ns="joinProjectPage">
                  If you reply to topics in the discussion forums, your profile
                  will be shared to identify the author.
                </Trans>
              </span>
            </li>

            {hasPrivacyPolicy && (
              <li className="flex space-x-3 py-2">
                <DocumentTextIcon className="w-8 h-8 text-gray-600" />
                <span className="flex-1">
                  <Trans ns="joinProjectPage">
                    This project's{" "}
                    <a
                      target="_blank"
                      href="/privacy-policy"
                      className="underline text-primary-600"
                    >
                      privacy policy
                    </a>{" "}
                    describes how your personal data will be used by the owners
                    of this project.
                  </Trans>
                </span>
              </li>
            )}
          </ul>
          <p className="pb-2">
            <Trans ns="joinProjectPage">
              By joining this project you are consenting to these uses of your
              personal data. Joining is optional but access to certain features
              and data may be limited otherwise. If you have any questions,
              please contact{" "}
              <a
                className="underline text-primary-600"
                href={`mailto:${data.projectPublicDetails.supportEmail}`}
              >
                {data.projectPublicDetails.supportEmail}
              </a>
            </Trans>
          </p>
          {data.project?.sessionHasPrivilegedAccess && (
            <Warning level="info" className="mx-auto">
              <Trans ns="joinProjectPage">
                Your account has been granted access to restricted content on
                this project. These privileges will not be active until you join
                as a participant.
              </Trans>
            </Warning>
          )}
        </div>
        <div className="bg-white sm:rounded-lg rounded-t-lg shadow-xl w-full sm:mx-auto lg:w-128 p-5 space-y-3">
          <h2 className="text-lg">
            <Trans ns="joinProjectPage">Your Profile</Trans>
          </h2>
          <UserProfileForm
            showValidationErrors={submissionAttempted}
            onChange={profile.setState}
            state={profile.state}
          />
          <div className="w-full flex flex-col items-center justify-center pt-2 pb-2">
            <button
              onClick={() => {
                setSubmissionAttempted(true);
                if (!profile.hasErrors) {
                  updateProfileAndJoin().then(() => {
                    history.push(redirectUrl);
                  });
                }
              }}
              disabled={
                profile.mutationState.loading || joinProjectState.loading
              }
              className={`${
                submissionAttempted && profile.hasErrors
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-primary-500 hover:bg-primary-600"
              } text-white shadow rounded w-full p-2 text-lg ${
                (profile.mutationState.loading || joinProjectState.loading) &&
                "opacity-50"
              }`}
            >
              <Trans ns="joinProjectPage">Join Project</Trans>
            </button>
            <button
              disabled={
                profile.mutationState.loading || joinProjectState.loading
              }
              className={`pt-2 text-base mt-2 border-b border-gray-300 hover:border-black ${
                (profile.mutationState.loading || joinProjectState.loading) &&
                "opacity-50"
              }`}
              onClick={() => {
                localStorage.setItem(
                  HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY,
                  "true"
                );
                if (new RegExp(`/${slug}/admin`).test(redirectUrl)) {
                  history.push(`/${slug}/app`);
                } else {
                  history.push(redirectUrl);
                }
              }}
            >
              <Trans ns="joinProjectPage">Skip for now</Trans>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
