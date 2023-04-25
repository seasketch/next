/* eslint-disable react/jsx-no-target-blank */
import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import NewProjectForm from "./NewProjectForm";
import { Link } from "react-router-dom";
import { useMeQuery, useVerifyEmailMutation } from "../generated/graphql";
import Skeleton from "../components/Skeleton";

const logos = [
  {
    title: "Waitt Institute",
    src: "/logos/waitt.webp",
    url: "https://www.waittinstitute.org/",
    smaller: true,
  },
  {
    title: "Blue Prosperity Coalition",
    src: "/logos/BPCLogo3.png",
    url: "https://www.blueprosperity.org/",
    bigger: true,
  },
  {
    title: "The Nature Conservancy",
    src: "/logos/tnc.svg",
    url: "https://tnc.org",
  },

  {
    title: "NOAA",
    src: "/logos/NOAA.svg",
    url: "https://www.noaa.gov",
    // bigger: true,
    className: "-mt-1",
  },
];

export default function NewProjectPage() {
  const { t } = useTranslation("frontpage");
  const { isAuthenticated } = useAuth0();
  const { data, loading, error } = useMeQuery();
  return (
    <main className="bg-gray-800 min-h-screen pt-12">
      <div className="mx-auto max-w-screen-xl">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="px-4 sm:px-6 sm:text-center md:max-w-2xl md:mx-auto lg:pl-8 lg:col-span-6 lg:text-left lg:flex lg:items-center">
            <div>
              <h2 className="mt-4 text-4xl tracking-tight leading-10 font-extrabold text-white sm:mt-5 sm:leading-none sm:text-6xl lg:mt-6 lg:text-5xl xl:text-6xl">
                <Trans ns="frontpage">
                  Create your own
                  <br className="hidden md:inline" />
                  <span className="text-primary-300"> SeaSketch Project</span>
                </Trans>
              </h2>
              <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                <Trans ns="frontpage">
                  Use our collaborative geodesign and survey tools for marine
                  spatial planning in your region. Your project will include
                  tools to visualize maps, create discussion forums, sketch
                  plans, and collect data using surveys - <i>for free!</i>{" "}
                  Analytical reports may be developed and customized using our{" "}
                  <a
                    target="_blank"
                    className="text-primary-300"
                    href="https://github.com/seasketch/geoprocessing"
                  >
                    geoprocessing framework
                  </a>
                  .
                </Trans>
              </p>
              <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                <Trans ns="frontpage">
                  Please contact us at{" "}
                  <a
                    className="text-primary-300"
                    target="_blank"
                    href="mailto:support@seasketch.org"
                  >
                    support@seasketch.org
                  </a>{" "}
                  to arrange a discussion about how SeaSketch can be used to
                  support your planning efforts.
                </Trans>
              </p>
              <p className="mt-8 text-sm text-white uppercase tracking-wide font-semibold sm:mt-10">
                {t("Trusted by")}
              </p>
              <div className="mt-5 w-full sm:mx-auto sm:max-w-lg lg:ml-0">
                <div className="flex flex-wrap justify-between items-center">
                  {logos.map((user) => (
                    <div key={user.title} className="flex justify-center px-1">
                      <a href={user.url}>
                        <img
                          style={{
                            filter:
                              "grayscale(100%) contrast(0.3) brightness(1.5)",
                          }}
                          className={`${
                            user.bigger
                              ? "h-15 sm:h-16"
                              : user.smaller
                              ? "h-8 sm:h-9"
                              : "h-10 sm:h-11"
                          } w-auto ${user.className}`}
                          src={user.src}
                          alt={user.title}
                        />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 sm:mt-16 lg:mt-0 lg:col-span-6">
            <div className="bg-white sm:max-w-md sm:w-full sm:mx-auto sm:rounded-lg sm:overflow-hidden">
              <div className="px-4 py-8 sm:px-10">
                {loading ? (
                  <div>
                    <Skeleton className="w-full h-8 mb-4 mt-4" />
                    <Skeleton className="w-full h-8 inline-block" />
                    <div className="w-full text-center">
                      <Skeleton className="w-3/4 mx-auto h-4 mt-2" />
                    </div>
                    <Skeleton className="w-full h-8 mt-5" />
                  </div>
                ) : isAuthenticated ? (
                  data?.isMyEmailVerified === false ? (
                    <PleaseVerifyEmail />
                  ) : (
                    <NewProjectForm />
                  )
                ) : (
                  <PleaseSignIn />
                )}
              </div>
              <div className="px-4 py-6 bg-gray-50 border-t-2 border-gray-200 sm:px-10">
                <p className="text-xs leading-5 text-gray-500">
                  <Trans ns="homepage">
                    By creating a project, you are agreeing to our{" "}
                    <Link
                      to="/terms-of-use"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      Terms of Use
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/privacy-policy"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </Trans>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PleaseSignIn() {
  const { t } = useTranslation("homepage");
  const { loginWithRedirect } = useAuth0();
  return (
    <>
      <span className="block w-full rounded-md shadow-md">
        <button
          onClick={() =>
            loginWithRedirect({
              appState: {
                returnTo: "/new-project",
              },
              authorizationParams: {
                screen_hint: "signup",
              },
            })
          }
          className="w-full flex justify-center py-2 px-4 border border-transparent text-md font-medium rounded-md text-white bg-primary-500 focus:outline-none focus:shadow-outline-indigo hover:bg-primary-600 transition duration-150 ease-in-out"
        >
          {t("Create an account")}
        </button>
      </span>

      <div className="mt-4 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm leading-5">
          <span className="px-2 bg-white text-gray-500">{t("Or")}</span>
        </div>
      </div>

      <span className="block w-full rounded-md shadow-md mt-4">
        <button
          onClick={() =>
            loginWithRedirect({
              appState: {
                returnTo: "/new-project",
              },
            })
          }
          className="w-full flex justify-center py-2 px-4 border border-transparent text-md font-medium rounded-md text-white bg-primary-300 hover:bg-primary-400 focus:outline-none focus:shadow-outline-indigo active:bg-primary-500 transition duration-150 ease-in-out"
        >
          {t("Sign In")}
        </button>
      </span>

      <p className="text-center mt-6">
        {t(
          "Logging into your account is the first step to creating a new SeaSketch project."
        )}
      </p>
    </>
  );
}

function PleaseVerifyEmail() {
  const { t } = useTranslation("homepage");
  const [verify, verifyState] = useVerifyEmailMutation();

  const sendingEmail = verifyState.loading;
  const sent = verifyState.called;
  return (
    <>
      <p className="text-center text-sm mt-6 mb-5">
        <Trans ns="homepage">
          Before creating a project, you must verify your email address. Please
          check your inbox for a verification email from{" "}
          <span className="font-semibold">do-not-reply@seasketch.org</span>
        </Trans>
      </p>
      <span className="block w-full rounded-md shadow-md">
        <button
          onClick={() => {
            verify({
              variables: {
                redirectUrl: window.location.toString(),
              },
            });
          }}
          className={`w-full flex items-center justify-center py-2 px-4 border border-transparent text-md font-medium rounded-md  transition duration-150 ease-in-out ${
            sendingEmail
              ? "bg-primary-300 text-white pointer-events-none"
              : sent
              ? "bg-primary-300 text-white pointer-events-none"
              : "text-white bg-primary-500 focus:outline-none focus:shadow-outline-indigo hover:bg-primary-600"
          }`}
        >
          <span className="relative">
            {sendingEmail
              ? t("Sending email...")
              : sent
              ? t("Email sent. Check your inbox  📨")
              : t("Resend verification email")}{" "}
          </span>
        </button>
      </span>
    </>
  );
}
