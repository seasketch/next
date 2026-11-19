import { useAuth0 } from "@auth0/auth0-react";
import { MailIcon } from "@heroicons/react/outline";
import { useTranslation, Trans } from "react-i18next";
import { useProjectInviteIngressFlow, IngressState } from ".";
import Button from "../components/Button";
import Spinner from "../components/Spinner";
import { useProjectMetadataQuery } from "../generated/graphql";
import ContactChooser from "../components/ContactChooser";
import {
  inviteSupportMailto,
  SEASKETCH_SUPPORT_EMAIL,
} from "../components/contactEmail";

/**
 * Implements user ingress from a project invitation email as described here:
 * https://github.com/seasketch/next/wiki/User-Ingress#project-invites
 * @param props
 * @returns
 */
export default function ProjectInviteLanding() {
  const { t } = useTranslation("invites");
  let {
    state,
    error,
    claims,
    accountExistsWithRecipientEmail,
    signInAndConfirm,
    registerAndConfirm,
    confirmWithCurrentAccount,
  } = useProjectInviteIngressFlow();
  const { data } = useProjectMetadataQuery({
    variables: {
      slug: claims?.projectSlug || "",
    },
  });
  const auth0 = useAuth0();
  const email = auth0.user?.email || claims?.email;
  const supportEmail = data?.projectPublicDetails?.supportEmail;
  const inviteeName = claims?.fullname || "";
  // Invite tokens often store the address as the name. A mailbox is not a headline.
  const personalName =
    inviteeName.includes("@") || state === IngressState.LoggedInWithDifferentEmail
      ? ""
      : inviteeName;
  const projectName = claims?.projectName;
  const problem =
    error instanceof Error ? error.message : error ? `${error}` : "";
  const supportMailto = inviteSupportMailto({
    to:
      state === IngressState.Expired ? supportEmail || undefined : undefined,
    error:
      state === IngressState.Expired
        ? // Written into the support message, which stays in English.
          // eslint-disable-next-line i18next/no-literal-string
          "This invitation has expired."
        : problem,
    projectName,
    projectSlug: claims?.projectSlug,
    recipientEmail: claims?.email,
    inviteId: claims?.inviteId,
    signedInEmail: auth0.user?.email,
    pageUrl: typeof window === "undefined" ? undefined : window.location.href,
  });
  const contactProject =
    supportEmail && (projectName || data?.projectPublicDetails?.name)
      ? {
          name: projectName || data?.projectPublicDetails?.name || "",
          email: supportEmail,
        }
      : undefined;

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-100 px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-lg rounded-lg bg-white px-6 py-8 shadow-xl sm:px-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          <MailIcon className="h-6 w-6 text-primary-600" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-center text-2xl font-semibold text-gray-900">
          {projectName || (
            <Trans ns="invites">This invitation link is not valid</Trans>
          )}
        </h1>
        {claims && (
          <p className="mt-2 text-center text-sm text-gray-500">
            <Trans ns="invites">
              You have been invited to participate in a SeaSketch project.
            </Trans>
          </p>
        )}
        {personalName ? (
          <p className="mt-2 text-center text-base font-medium text-gray-800">
            <Trans ns="invites">Welcome, {personalName}!</Trans>
          </p>
        ) : claims?.email &&
          state !== IngressState.LoggedInWithDifferentEmail ? (
          <p className="mt-2 text-center text-sm text-gray-600">
            <Trans ns="invites">Sent to </Trans>
            <span className="break-all font-medium text-gray-900">
              {claims.email}
            </span>
          </p>
        ) : null}

        <div className="mt-6 border-t border-gray-200 pt-6">{renderState()}</div>
        {state === IngressState.LoggedInWithDifferentEmail && (
          <p className="mt-4 border-t border-gray-200 pt-4 text-center text-sm text-gray-500">
            <Trans ns="invites">
              This invitation was originally sent to{" "}
              <span className="font-medium text-gray-800">{claims?.email}</span>
              .
            </Trans>{" "}
            {accountExistsWithRecipientEmail && (
              <Trans ns="invites">
                An account with this email address already exists.
              </Trans>
            )}
          </p>
        )}
      </div>
    </div>
  );

  function renderState() {
    switch (state) {
      case IngressState.Expired:
        return (
          <div className="flex w-full flex-col items-center gap-3">
            <div className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-900">
              <Trans ns="invites">
                Your invitation to this project has expired.
              </Trans>
            </div>
            <p className="text-center text-sm text-gray-600">
              <Trans ns="invites">Contact </Trans>
              <a className="text-primary-600 underline" href={supportMailto}>
                {supportEmail || SEASKETCH_SUPPORT_EMAIL}
              </a>
              {supportEmail ? (
                <Trans ns="invites"> to request a new invitation.</Trans>
              ) : (
                <Trans ns="invites"> if you need help with this invitation.</Trans>
              )}
            </p>
          </div>
        );
      case IngressState.Error:
        return (
          <div className="flex w-full flex-col items-center gap-3">
            <div className="w-full rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-900">
              {problem}
            </div>
            <p className="text-center text-sm text-gray-600">
              <Trans ns="invites">Contact </Trans>
              <a className="text-primary-600 underline" href={supportMailto}>
                {SEASKETCH_SUPPORT_EMAIL}
              </a>
              <Trans ns="invites"> if you need help with this invitation.</Trans>
            </p>
          </div>
        );
      case IngressState.Verifying:
        return (
          <div className="flex flex-col items-center">
            <Spinner style={{ marginLeft: 0, marginBottom: 5 }} />
            <p className="text-center text-sm text-gray-500">
              <Trans ns="invites">Verifying invitation code</Trans>
            </p>
          </div>
        );
      case IngressState.AlreadyAccepted:
        return (
          <div className="flex w-full flex-col items-center gap-4">
            <p className="text-center text-sm text-gray-600">
              <Trans ns="invites">
                This invitation has already been accepted.
              </Trans>
            </p>
            <Button
              primary
              href={`/${claims!.projectSlug}`}
              label={t("Proceed to the project")}
              className="w-full sm:w-auto"
              buttonClassName="w-full justify-center whitespace-nowrap sm:w-auto"
            />
            <p className="text-center text-sm text-gray-500">
              <Trans ns="invites">If you believe this to be an error, </Trans>
              <ContactChooser
                className="whitespace-nowrap font-medium text-primary-600 underline"
                project={contactProject}
              >
                <Trans ns="invites">contact support</Trans>
              </ContactChooser>
              <span>.</span>
            </p>
          </div>
        );
      case IngressState.Confirming:
        return (
          <div className="flex flex-col items-center">
            <Spinner style={{ marginLeft: 0, marginBottom: 5 }} />
            <p className="text-center text-sm text-gray-500">
              <Trans ns="invites">Confirming invite</Trans>
            </p>
          </div>
        );
      case IngressState.LoggedOut:
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {accountExistsWithRecipientEmail ? (
              <>
                <Button
                  primary
                  onClick={() => signInAndConfirm()}
                  label={t("Sign In")}
                  className="w-full"
                  buttonClassName="w-full justify-center whitespace-nowrap"
                />
                <Button
                  onClick={() => registerAndConfirm()}
                  label={t("Create an Account")}
                  className="w-full"
                  buttonClassName="w-full justify-center whitespace-nowrap"
                />
              </>
            ) : (
              <>
                <Button
                  primary
                  onClick={() => registerAndConfirm()}
                  label={t("Create an Account")}
                  className="w-full"
                  buttonClassName="w-full justify-center whitespace-nowrap"
                />
                <Button
                  onClick={() => signInAndConfirm()}
                  label={t("Sign In")}
                  className="w-full"
                  buttonClassName="w-full justify-center whitespace-nowrap"
                />
              </>
            )}
          </div>
        );
      case IngressState.LoggedInWithDifferentEmail:
        return accountExistsWithRecipientEmail ? (
          <div className="flex w-full flex-col gap-3">
            <Button
              primary
              onClick={() => signInAndConfirm(true)}
              label={
                <Trans ns="invites">
                  Logout and sign in as {claims?.email}
                </Trans>
              }
              className="w-full"
              buttonClassName="w-full justify-center whitespace-normal text-center"
            />
            <Button
              onClick={() => confirmWithCurrentAccount()}
              label={
                <Trans i18nKey="Accept as" ns="invites">
                  Accept as {{ email }}
                </Trans>
              }
              className="w-full"
              buttonClassName="w-full justify-center whitespace-normal text-center"
            />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <Button
              primary
              onClick={() => confirmWithCurrentAccount()}
              label={
                <Trans i18nKey="Accept as" ns="invites">
                  Accept as {{ email }}
                </Trans>
              }
              className="w-full"
              buttonClassName="w-full justify-center whitespace-normal text-center"
            />
            <Button
              onClick={() => signInAndConfirm(true)}
              label={t("Use another account")}
              className="w-full"
              buttonClassName="w-full justify-center whitespace-nowrap"
            />
          </div>
        );
      case IngressState.LoggedInWithMatchingEmail:
        return null;
      default:
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error(`Unrecognized state ${state}`);
    }
  }
}
