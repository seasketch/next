import React, { useRef, useState } from "react";
import Spinner from "../components/Spinner";
import {
  ProjectAccessControlSetting,
  ProjectAccessStatus,
  useResendEmailVerificationMutation,
  useRequestInviteOnlyProjectAccessMutation,
} from "../generated/graphql";
import {
  CheckIcon,
  ExclamationIcon,
  LockClosedIcon,
} from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import Button from "../components/Button";
import { useAuth0 } from "@auth0/auth0-react";
import { AnimatePresence, motion } from "framer-motion";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useCurrentProjectMetadata from "../useCurrentProjectMetadata";
import useDialog from "../components/useDialog";
import UserProfileForm, { useUserProfileState } from "./UserProfileForm";

interface ProfileFormValues {
  fullname: string;
  nickname: string;
  email: string;
  affiliations: string;
  // picture: string;
}

export const ProjectAccessGate: React.FunctionComponent<{ admin?: boolean }> = (
  props
) => {
  const auth0 = useAuth0();
  const onError = useGlobalErrorHandler();
  const { data, loading, error, refetch } = useCurrentProjectMetadata({
    onError,
    fetchPolicy: "cache-and-network",
  });
  const { t } = useTranslation("projectLanding");
  const [resendVerification, resendVerificationState] =
    useResendEmailVerificationMutation();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [madeRequest, setMadeRequest] = useState(false);
  const { alert } = useDialog();
  // const [reverseTransition, setReverseTransition] = useState(false);
  let title = <></>;
  let buttons = <></>;
  let body = <></>;
  let icon = <></>;
  const errorIcon = (
    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
      <ExclamationIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
    </div>
  );

  const lockedIcon = (
    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10">
      <LockClosedIcon className="h-6 w-6 text-gray-700" />
    </div>
  );
  const sentIcon = (
    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10 bg-green-600">
      <CheckIcon className="h-6 w-6 text-gray-100" />
    </div>
  );
  const contactSupport = (
    <Button
      // innerRef={initialFocusRef}
      mailTo={`support@seasketch.org`}
      label={<Trans ns="projectLanding">Contact support</Trans>}
    />
  );
  let status: ProjectAccessStatus | null =
    data?.projectPublicDetails?.accessStatus || null;

  // status = ProjectAccessStatus.DeniedNotRequested;
  // status = ProjectAccessStatus.DeniedNotApproved;
  if (loading) {
    return (
      <div
        style={{ height: "100%" }}
        className="w-full flex min-h-full h-96 justify-center text-center align-middle items-center content-center justify-items-center place-items-center place-content-center"
      >
        <Spinner />
      </div>
    );
  } else if ((status as ProjectAccessStatus) === ProjectAccessStatus.Granted) {
    if (!props.admin || data?.project?.sessionIsAdmin) {
      return <div>{props.children}</div>;
    } else {
      icon = lockedIcon;
      title = <Trans ns="projectLanding">Admins Only</Trans>;
      body = (
        <Trans ns="projectLanding">
          Access to this area of{" "}
          <b className="font-bold">{data!.projectPublicDetails!.name}</b> is
          limited to project administrators.
        </Trans>
      );
      if (data?.me) {
        buttons = (
          <Button
            mailTo={data!.projectPublicDetails!.supportEmail!}
            label={
              <Trans ns="projectLanding">
                Contact{" "}
                {data!.projectPublicDetails!.supportEmail ||
                  "support@seasketch.org"}
              </Trans>
            }
          />
        );
      } else {
        buttons = (
          <>
            <Button
              onClick={() =>
                auth0.loginWithRedirect({
                  appState: {
                    returnTo: window.location.pathname,
                  },
                  authorizationParams: {
                    prompt: "login",
                  },
                })
              }
              primary
              label={<Trans ns="projectLanding">Sign in</Trans>}
              buttonClassName="md:w-full"
              disabled={
                resendVerificationState.loading ||
                resendVerificationState.data?.resendVerificationEmail.success
              }
            />
          </>
        );
      }
    }
  } else if (error || !data) {
    title = <Trans ns="projectLanding">Error Loading Project</Trans>;
    body = error ? (
      <p>{error.message}</p>
    ) : (
      <Trans ns="projectLanding">
        The API server returned null data for this project
      </Trans>
    );
    buttons = contactSupport;
    icon = errorIcon;
  } else if (!data.projectPublicDetails) {
    title = <Trans ns="projectLanding">Error Loading Project</Trans>;
    body = (
      <Trans ns="projectLanding">
        The API server did not return any public details for this project.
      </Trans>
    );

    buttons = contactSupport;
    icon = errorIcon;
  } else {
    switch (status as ProjectAccessStatus) {
      case ProjectAccessStatus.ProjectDoesNotExist:
        icon = errorIcon;
        buttons = contactSupport;
        title = <Trans ns="projectLanding">Project Not Found</Trans>;
        body = (
          <Trans ns="projectLanding">
            SeaSketch does not have a project located at this url. Try browsing
            our{" "}
            <a className="underline text-primary-500" href="/projects">
              list of projects
            </a>{" "}
            to find what you are looking for.
          </Trans>
        );
        break;
      case ProjectAccessStatus.DeniedAdminsOnly:
        icon = lockedIcon;
        title = <Trans ns="projectLanding">Admins Only</Trans>;
        body = (
          <Trans ns="projectLanding">
            Access to{" "}
            <b className="font-bold">{data.projectPublicDetails.name}</b> is
            limited to project administrators. You may contact the site support
            email to request access.
          </Trans>
        );
        buttons = (
          <Button
            mailTo={data.projectPublicDetails.supportEmail!}
            label={
              <Trans ns="projectLanding">
                Contact{" "}
                {data.projectPublicDetails.supportEmail ||
                  "support@seasketch.org"}
              </Trans>
            }
          />
        );

        break;
      case ProjectAccessStatus.DeniedNotApproved:
        icon = madeRequest ? sentIcon : lockedIcon;
        title = madeRequest ? (
          <Trans ns="projectLanding">Your Request Has Been Sent</Trans>
        ) : (
          <Trans ns="projectLanding">Request Awaiting Approval</Trans>
        );
        body = (
          <Trans ns="projectLanding">
            Your request for access to{" "}
            <b className="font-bold">{data.projectPublicDetails.name}</b> has
            been received but has not yet been approved. You may wish to follow
            up with the project's support email.
          </Trans>
        );

        buttons = (
          <Button
            mailTo={data.projectPublicDetails.supportEmail!}
            label={
              <Trans ns="projectLanding">
                Contact {data.projectPublicDetails.supportEmail!}
              </Trans>
            }
          />
        );
        break;
      case ProjectAccessStatus.DeniedEmailNotVerified:
        icon = lockedIcon;
        title = <Trans ns="projectLanding">Email Not Verified</Trans>;
        body = (
          <Trans ns="projectLanding">
            You are approved to access{" "}
            <b className="font-bold">{data.projectPublicDetails.name}</b> but
            first you must verify your email address. This is to protect your
            account and sensitive data within the project. Check your email,
            including your spam folder, for a verification link from SeaSketch.
          </Trans>
        );

        buttons = (
          <Button
            onClick={() =>
              resendVerification().then((response) => {
                if (response.data?.resendVerificationEmail.success === true) {
                  alert(t("Verification email sent. Check your inbox."));
                } else {
                  if (response.errors) {
                    alert(
                      `Problem sending verification email. ${response.errors.toString()}`
                    );
                  } else if (response.data?.resendVerificationEmail.error) {
                    alert(
                      `Problem sending verification email. ${response.data?.resendVerificationEmail.error}`
                    );
                  }
                }
              })
            }
            label={<Trans ns="projectLanding">Resend verification email</Trans>}
            disabled={
              resendVerificationState.loading ||
              resendVerificationState.data?.resendVerificationEmail.success
            }
          />
        );
        break;
      case ProjectAccessStatus.DeniedNotRequested:
        icon = lockedIcon;
        title = <Trans ns="projectLanding">Private Project</Trans>;
        body = (
          <Trans ns="projectLanding">
            <b className="font-bold">{data.projectPublicDetails.name}</b> can
            only be accessed with an invitation. To request access, first fill
            out and share your profile with this project.
          </Trans>
        );

        buttons = (
          <Button
            onClick={() => {
              // setReverseTransition(false);
              setShowProfileForm(true);
            }}
            label={
              <Trans ns="projectLanding">
                Share Profile and Request Access
              </Trans>
            }
            buttonClassName="md:w-full"
            disabled={
              resendVerificationState.loading ||
              resendVerificationState.data?.resendVerificationEmail.success
            }
          />
        );
        break;
      case ProjectAccessStatus.DeniedAnon:
        icon = lockedIcon;
        title = <Trans ns="projectLanding">Private Project</Trans>;
        body = (
          <Trans ns="projectLanding">
            <b className="font-bold">{data.projectPublicDetails.name}</b> can
            only be accessed with an invitation. Sign in or create a SeaSketch
            account to request access.
          </Trans>
        );
        if (
          data.projectPublicDetails.accessControl ===
          ProjectAccessControlSetting.AdminsOnly
        ) {
          body = (
            <Trans ns="projectLanding">
              <b className="font-bold">{data.projectPublicDetails.name}</b> can
              only be accessed by project administrators.
            </Trans>
          );
        }

        buttons = (
          <>
            <Button
              onClick={() =>
                auth0.loginWithRedirect({
                  authorizationParams: {
                    prompt: "login",
                  },
                  appState: {
                    returnTo: window.location.pathname,
                  },
                })
              }
              primary
              label={<Trans ns="projectLanding">Sign in</Trans>}
              buttonClassName="md:w-full"
              disabled={
                resendVerificationState.loading ||
                resendVerificationState.data?.resendVerificationEmail.success
              }
            />
            {data.projectPublicDetails.accessControl !==
              ProjectAccessControlSetting.AdminsOnly && (
              <Button
                onClick={() =>
                  auth0.loginWithRedirect({
                    authorizationParams: {
                      screen_hint: "signup",
                    },
                    appState: {
                      returnTo: window.location.pathname,
                    },
                  })
                }
                label={<Trans ns="projectLanding">Create an account</Trans>}
                buttonClassName="md:w-full"
                disabled={
                  resendVerificationState.loading ||
                  resendVerificationState.data?.resendVerificationEmail.success
                }
              />
            )}
          </>
        );
        break;
      default:
        break;
    }
  }

  const profileInitialFormValues: ProfileFormValues = {
    fullname: data?.me?.profile?.fullname || auth0.user?.name || "",
    email: data?.me?.profile?.email || auth0.user?.email || "",
    nickname:
      data?.me?.profile?.nickname ||
      (data?.me?.profile?.fullname || auth0.user?.name
        ? ""
        : auth0.user?.nickname || ""),
    affiliations: data?.me?.profile?.affiliations || "",
  };

  return (
    <>
      {/* {props.children} */}
      <div
        className="fixed z-50 inset-0 overflow-y-auto overflow-x-hidden max-w-full"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="min-h-screen min-w-screen max-w-screen overflow-x-hidden text-center sm:block mx-auto bg-gray-200 bg-opacity-90">
          {/* <div
            className="fixed inset-0 bg-gray-200 bg-opacity-90 transition-opacity"
            aria-hidden="true"
          ></div>

          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
            // eslint-disable-next-line i18next/no-literal-string
          >
            &#8203;
          </span> */}
          <AnimatePresence initial={false}>
            {showProfileForm ? (
              <ProfileForm
                initialValues={profileInitialFormValues}
                onRequestClose={() => setShowProfileForm(false)}
                refetchProjectState={() => refetch()}
                projectId={data!.projectPublicDetails!.id!}
                userId={data!.me!.id!}
                nickname={
                  data?.me?.profile?.nickname ||
                  (data?.me?.profile?.fullname || auth0.user?.name
                    ? ""
                    : auth0.user?.nickname || "")
                }
                email={data?.me?.profile?.email || auth0.user?.email || ""}
                affiliations={data?.me?.profile?.affiliations || ""}
                onMadeRequest={() => setMadeRequest(true)}
              />
            ) : (
              <DialogContainer
                enterFromRight={false}
                exitToLeft={true}
                key="gate"
              >
                <div className="sm:flex sm:items-start pt-5 pb-4">
                  {icon}
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3
                      className="text-lg leading-6 font-medium text-gray-900"
                      id="modal-title"
                    >
                      {title}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">{body}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 flex w-full justify-center sm:justify-end sm:space-x-1">
                  {buttons}
                </div>
              </DialogContainer>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

const DialogContainer: React.FunctionComponent<{
  enterFromRight: boolean;
  exitToLeft: boolean;
  skipAnimation?: boolean;
}> = (props) => {
  return (
    <motion.div
      transition={{ duration: 0.5 }}
      initial={
        props.skipAnimation
          ? { x: "-50%", y: "-33.333%", opacity: 1 }
          : {
              x: props.enterFromRight ? 500 : -500,
              opacity: 0,
              y: "-33.333%",
            }
      }
      animate={{ x: "-50%", y: "-33.333%", opacity: 1 }}
      exit={{ x: props.exitToLeft ? -500 : 500, opacity: 0, y: "-33.333%" }}
      className=" bg-white block sm:align-middle absolute sm:max-w-lg sm:rounded-lg px-4 text-left overflow-y-auto pb-6 sm:overflow-hidden shadow-xl sm:p-6 flex-nowrap left-1/2 top-1/3 w-screen h-screen sm:w-max sm:h-auto max-h-full"
    >
      {props.children}
    </motion.div>
  );
};

export const ProfileForm = ({
  initialValues,
  onRequestClose,
  refetchProjectState,
  projectId,
  name,
  nickname,
  email,
  userId,
  affiliations,
  onMadeRequest,
  skipAnimation,
}: {
  initialValues: ProfileFormValues;
  onRequestClose: () => void;
  refetchProjectState: () => Promise<any>;
  projectId: number;
  name?: string;
  nickname?: string;
  email?: string;
  userId: number;
  affiliations?: string;
  onMadeRequest: () => void;
  skipAnimation?: boolean;
}) => {
  const { t } = useTranslation("projectLanding");
  const onError = useGlobalErrorHandler();
  const [requestAccess] = useRequestInviteOnlyProjectAccessMutation({
    onError,
  });
  const profile = useUserProfileState();
  const hasPrivacyPolicy = false;

  return (
    <DialogContainer
      enterFromRight={true}
      exitToLeft={false}
      skipAnimation={skipAnimation}
      key="share"
    >
      <div className="sm:flex sm:items-start pt-5 pb-4">
        <div className="mt-3 text-left sm:mt-0 sm:ml-4">
          <h3
            className="text-lg leading-6 font-medium text-gray-900"
            id="modal-title"
          >
            <Trans ns="projectLanding">User Profile</Trans>
          </h3>
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-4">
              <Trans ns="projectLanding">
                Information in the profile will be included with your request
              </Trans>
            </div>
            <UserProfileForm
              onChange={profile.setState}
              showValidationErrors={profile.submissionAttempted}
              state={profile.state}
            />
            <div className="relative flex items-start mt-5">
              <div className="flex items-center h-5">
                <input
                  checked
                  onClick={() => {
                    alert(
                      t(
                        "Profile sharing is required to access private projects so that administrators know who is requesting access.\n\nYour profile will only be shared more broadly if you post in the forums, and you can turn off profile sharing at any time while losing access to these features."
                      )
                    );
                  }}
                  readOnly
                  id="candidates"
                  aria-describedby="candidates-description"
                  name="candidates"
                  type="checkbox"
                  className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  htmlFor="candidates"
                  className="font-medium text-gray-700"
                >
                  <Trans ns="projectLanding">
                    Consent to share this personal information
                  </Trans>
                </label>
                <p id="candidates-description" className="text-gray-500">
                  <Trans ns="projectLanding">
                    I understand that this profile will be shared with project
                    admins and accompany my posts to the discussion forums.
                  </Trans>
                </p>
                {hasPrivacyPolicy && (
                  <p>
                    <a
                      target="_blank"
                      className="underline text-primary-500"
                      href="/privacy-policy"
                    >
                      <Trans ns="projectLanding">Privacy Policy</Trans>
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 sm:mt-2 flex w-full justify-center sm:justify-end space-x-4 sm:space-x-1">
        <Button label={t("Cancel")} onClick={onRequestClose} />
        <Button
          loading={profile.mutationState.loading}
          disabled={profile.mutationState.loading}
          type="submit"
          label={t("Send Request")}
          primary
          onClick={async () => {
            try {
              await profile.submit();
              await requestAccess({
                variables: {
                  projectId,
                },
              });
              await refetchProjectState();
              onMadeRequest();
              onRequestClose();
            } catch (e) {
              console.error(e);
            }
          }}
        />
      </div>
    </DialogContainer>
  );
};
