import { useAuth0 } from "@auth0/auth0-react";
import React, { useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useProjectInviteIngressFlow, IngressState } from ".";
import Button from "../components/Button";
import Spinner from "../components/Spinner";

/**
 * Implements user ingress from a project invitation email as described here:
 * https://github.com/seasketch/next/wiki/User-Ingress#project-invites
 * @param props
 * @returns
 */
export default function ProjectInviteLanding() {
  const { t } = useTranslation();
  let {
    state,
    error,
    claims,
    accountExistsWithRecipientEmail,
    signInAndConfirm,
    registerAndConfirm,
    confirmWithCurrentAccount,
  } = useProjectInviteIngressFlow();
  const auth0 = useAuth0();
  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto text-center py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          <span className="block">
            {!claims ? (
              <Trans>Welcome!</Trans>
            ) : (
              <Trans>Welcome, {claims.fullname}!</Trans>
            )}
          </span>
        </h2>
        <p className="block text-gray-500 md:text-lg mt-2 mb-1">
          <Trans>
            You have been invited to participate in a SeaSketch project.
          </Trans>
        </p>
        <h3 className="block text-primary-600 text-3xl font-extrabold tracking-tigh sm:text-4xl">
          {claims?.projectName}
        </h3>

        <div className="mt-8 flex justify-center">
          <div className="flex text-center items-center">
            {(() => {
              switch (state) {
                case IngressState.Expired:
                  return (
                    <>
                      <span className="text-red-900">
                        <Trans>
                          Your invitation to this project has expired.
                        </Trans>
                      </span>
                    </>
                  );
                case IngressState.Error:
                  return (
                    <>
                      <span className="text-red-900">{`${error}`}</span>
                    </>
                  );
                case IngressState.Verifying:
                  return (
                    <>
                      <div className="flex flex-col items-center">
                        <Spinner style={{ marginLeft: 0, marginBottom: 5 }} />
                        <p className="text-gray-500 text-center">
                          <Trans>Verifying invitation code</Trans>
                        </p>
                      </div>
                    </>
                  );

                case IngressState.AlreadyAccepted:
                  return (
                    <p>
                      <Trans>
                        This invitation has already been accepted.
                        <a
                          className="text-primary-500 font-bold"
                          href={`/${claims!.projectSlug}`}
                        >
                          {" "}
                          Proceed to the project{" "}
                        </a>{" "}
                        or{" "}
                        <a
                          className="text-primary-500 font-bold"
                          href="mailto:support@seasketch.org"
                        >
                          {" "}
                          contact support{" "}
                        </a>
                        if you believe this to be an error.
                      </Trans>
                    </p>
                  );
                case IngressState.Confirming:
                  return (
                    <>
                      <div className="flex flex-col items-center">
                        <Spinner style={{ marginLeft: 0, marginBottom: 5 }} />
                        <p className="text-gray-500 text-center">
                          <Trans>Confirming invite</Trans>
                        </p>
                      </div>
                    </>
                  );
                case IngressState.LoggedOut:
                  return (
                    <div
                      className={`flex ${
                        accountExistsWithRecipientEmail
                          ? "flex-row-reverse"
                          : ""
                      } `}
                    >
                      <div className="inline-flex mx-1">
                        <Button
                          primary={!accountExistsWithRecipientEmail}
                          onClick={() => registerAndConfirm()}
                          label={t("Create an Account")}
                        />
                      </div>
                      <div className="inline-flex mx-1">
                        <Button
                          primary={accountExistsWithRecipientEmail}
                          onClick={() => signInAndConfirm()}
                          label={t("Sign In")}
                        />
                      </div>
                    </div>
                  );
                case IngressState.LoggedInWithDifferentEmail:
                  return accountExistsWithRecipientEmail ? (
                    // If an account exists, prefer they log in as that user
                    <>
                      <div className="ml-3 inline-flex">
                        <Button
                          primary
                          onClick={() => signInAndConfirm(true)}
                          label={t(`Logout and sign in as ${claims?.email}`)}
                        />
                      </div>
                      <div className="ml-3 inline-flex">
                        <Button
                          onClick={() => confirmWithCurrentAccount()}
                          label={t(`Accept as ${auth0.user.email}`)}
                        />
                      </div>
                    </>
                  ) : (
                    // If no account exists, prefer the current user
                    <>
                      <div className="ml-3 inline-flex">
                        <Button
                          primary
                          onClick={() => confirmWithCurrentAccount()}
                          label={t(`Accept as ${auth0.user.email}`)}
                        />
                      </div>
                      <div className="ml-3 inline-flex">
                        <Button
                          onClick={() => signInAndConfirm(true)}
                          label={t("Use another account")}
                        />
                      </div>
                    </>
                  );

                case IngressState.LoggedInWithMatchingEmail:
                  // do nothing
                  break;
                default:
                  // eslint-disable-next-line i18next/no-literal-string
                  throw new Error(`Unrecognized state ${state}`);
              }
            })()}
          </div>
        </div>
        {state === IngressState.LoggedInWithDifferentEmail && (
          <p className="text-gray-500 mt-4">
            <Trans>
              This invitation was originally sent to{" "}
              <span className="font-bold text-primary-500">
                {claims?.email}
              </span>
              .
            </Trans>{" "}
            {accountExistsWithRecipientEmail && (
              <Trans>An account with this email address already exists.</Trans>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
