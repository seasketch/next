import {
  ChatAlt2Icon,
  DocumentTextIcon,
  IdentificationIcon,
} from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import Spinner from "../components/Spinner";
import TextInput from "../components/TextInput";
import {
  ParticipationStatus,
  useJoinProjectMutation,
  useProjectMetadataLazyQuery,
  useProjectMetadataQuery,
  useUpdateProfileMutation,
} from "../generated/graphql";
import { useCallback, useContext, useEffect, useState } from "react";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import Warning from "../components/Warning";
import useDialog from "../components/useDialog";
import { GraphqlQueryCacheContext } from "../offline/GraphqlQueryCache/useGraphqlQueryCache";
import { strategies } from "../offline/GraphqlQueryCache/strategies";

export const HAS_SKIPPED_JOIN_PROJECT_PROMPT_LOCALSTORAGE_KEY =
  "has-skipped-join-project-prompt";

export default function JoinProject() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const history = useHistory();
  const { data, loading } = useProjectMetadataQuery({
    variables: {
      slug,
    },
  });
  const onError = useGlobalErrorHandler();
  const [updateProfile, updateProfileState] = useUpdateProfileMutation({
    onError,
  });
  const [joinProject, joinProjectState] = useJoinProjectMutation({ onError });
  const [lazyProjectMetadata] = useProjectMetadataLazyQuery();
  const graphqlQueryCache = useContext(GraphqlQueryCacheContext);

  const location = new URL(window.location.toString());
  const redirectUrl =
    // eslint-disable-next-line i18next/no-literal-string
    location.searchParams.get("redirectUrl") || `/${slug}/app`;

  const [profile, setProfile] = useState<{
    fullname: string;
    nickname?: string;
    email?: string;
    affiliations?: string;
  }>({
    ...(data?.me?.profile as {
      fullname?: string;
      nickname?: string;
      email?: string;
      affiliations?: string;
    }),
    fullname: data?.me?.profile?.fullname || "",
  });

  const updateProfileAndJoin = useCallback(async () => {
    if (data?.me?.id && data.project?.id) {
      const projectId = data.project.id;
      const userId = data.me.id;
      return updateProfile({
        variables: {
          userId,
          ...profile,
        },
      }).then(async () => {
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
  }, [
    data?.me?.id,
    data?.project?.id,
    updateProfile,
    profile,
    joinProject,
    graphqlQueryCache,
    slug,
    lazyProjectMetadata,
  ]);

  useEffect(() => {
    if (data?.me?.profile) {
      setProfile({
        ...(data?.me.profile as {
          fullname: string;
          nickname?: string;
          email?: string;
          affiliations?: string;
        }),
      });
    }
  }, [data?.me?.profile]);

  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const [errors, setErrors] = useState<{ fullname?: string }>({});

  const hasPrivacyPolicy = false;

  useEffect(() => {
    if (profile.fullname.length < 1) {
      setErrors((prev) => ({
        ...prev,
        fullname: "Name is required",
      }));
    } else {
      setErrors((prev) => ({}));
    }
  }, [profile.fullname]);

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

  if (!data.project || !data.projectPublicDetails) {
    return <Trans>Project not found</Trans>;
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
            <Trans>Join this Project</Trans>
          </h1>
          <p>
            <Trans>
              By becoming a participant you will gain access to features such as
              the discussion forums and your account can be given access to
              secure data layers. To join, we need your consent to share a user
              profile with the project.
            </Trans>
          </p>
          <h3 className="font-semibold text-lg">
            <Trans>How will my profile be used?</Trans>
          </h3>
          <ul className="list-decimal">
            <li className="flex space-x-3 py-2">
              <IdentificationIcon className="w-8 h-8 text-gray-600" />
              <span className="flex-1">
                <Trans>
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
                <Trans>
                  If you reply to topics in the discussion forums, your profile
                  will be shared to identify the author.
                </Trans>
              </span>
            </li>

            {hasPrivacyPolicy && (
              <li className="flex space-x-3 py-2">
                <DocumentTextIcon className="w-8 h-8 text-gray-600" />
                <span className="flex-1">
                  <Trans>
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
            <Trans>
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
          {data.project.sessionHasPrivilegedAccess && (
            <Warning level="info" className="mx-auto">
              <Trans>
                Your account has been granted access to restricted content on
                this project. These privileges will not be active until you join
                as a participant.
              </Trans>
            </Warning>
          )}
        </div>
        <div className="bg-white sm:rounded-lg rounded-t-lg shadow-xl w-full sm:mx-auto lg:w-128 p-5 space-y-3">
          <h2 className="text-lg">
            <Trans>Your Profile</Trans>
          </h2>
          <TextInput
            required
            name="fullname"
            onChange={(fullname) =>
              setProfile((prev) => ({ ...prev, fullname }))
            }
            error={submissionAttempted ? errors.fullname : undefined}
            value={profile.fullname}
            label={<Trans>Full Name</Trans>}
          />
          <TextInput
            name="nickname"
            onChange={(nickname) =>
              setProfile((prev) => ({ ...prev, nickname }))
            }
            value={profile.nickname || ""}
            label={<Trans>Nickname</Trans>}
            description={
              <Trans>
                If included, this will be shown as your primary username while
                participating in the discussion forums.
              </Trans>
            }
          />
          <TextInput
            name="email"
            onChange={(email) => setProfile((prev) => ({ ...prev, email }))}
            value={profile.email || ""}
            description={
              <Trans>
                Will be shown in your posts to the discussion forums if
                provided.
              </Trans>
            }
            label={<Trans>Email Address</Trans>}
          />
          <TextInput
            textarea
            name="affiliations"
            onChange={(affiliations) =>
              setProfile((prev) => ({ ...prev, affiliations }))
            }
            value={profile.affiliations || ""}
            placeholder="e.g. University of California Santa Barbara"
            label={<Trans>Affiliations and Bio</Trans>}
          />
          <div className="w-full flex flex-col items-center justify-center pt-2 pb-2">
            <button
              onClick={() => {
                setSubmissionAttempted(true);
                if (Object.values(errors).length === 0) {
                  updateProfileAndJoin().then(() => {
                    history.push(redirectUrl);
                  });
                }
              }}
              disabled={updateProfileState.loading || joinProjectState.loading}
              className={`${
                submissionAttempted && Object.values(errors).length > 0
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-primary-500 hover:bg-primary-600"
              } text-white shadow rounded w-full p-2 text-lg ${
                (updateProfileState.loading || joinProjectState.loading) &&
                "opacity-50"
              }`}
            >
              <Trans>Join Project</Trans>
            </button>
            <button
              disabled={updateProfileState.loading || joinProjectState.loading}
              className={`pt-2 text-base mt-2 border-b border-gray-300 hover:border-black ${
                (updateProfileState.loading || joinProjectState.loading) &&
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
              <Trans>Skip for now</Trans>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
