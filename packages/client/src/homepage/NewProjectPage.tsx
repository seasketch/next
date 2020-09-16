import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import NewProjectForm from "./NewProjectForm";
import { Link } from "react-router-dom";

const logos = [
  {
    title: "Waitt Institute",
    src: "/logos/waitt.webp",
    url: "https://www.waittinstitute.org/",
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
  },
  {
    title: "Rare",
    src: "/logos/Rare.webp",
    url: "https://rare.org/",
  },
  {
    title: "Oceano Azule",
    src: "/logos/OA.webp",
    url: "https://www.oceanoazulfoundation.org/",
  },
];

export default function NewProjectPage() {
  const { t, i18n } = useTranslation(["homepage"]);
  const { isAuthenticated } = useAuth0();
  return (
    <main className="bg-gray-800 min-h-screen pt-12">
      <div className="mx-auto max-w-screen-xl">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="px-4 sm:px-6 sm:text-center md:max-w-2xl md:mx-auto lg:pl-8 lg:col-span-6 lg:text-left lg:flex lg:items-center">
            <div>
              <h2 className="mt-4 text-4xl tracking-tight leading-10 font-extrabold text-white sm:mt-5 sm:leading-none sm:text-6xl lg:mt-6 lg:text-5xl xl:text-6xl">
                <Trans t={t}>
                  Create your own
                  <br className="hidden md:inline" />
                  <span className="text-primary-300"> SeaSketch Project</span>
                </Trans>
              </h2>
              <p className="mt-3 text-base text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                <Trans t={t}>
                  Use our collaborative geodesign tools for ocean conservation
                  planning in your region. <i>It's free!</i> Your project will
                  include tools to visualize data, create discussion forums,
                  sketch plans, and collect data using surveys. Built-in reports
                  include data from Global Fishing Watch, and can be customized
                  using our Developer API.
                </Trans>
              </p>
              <p className="mt-8 text-sm text-white uppercase tracking-wide font-semibold sm:mt-10">
                {t("Trusted by")}
              </p>
              <div className="mt-5 w-full sm:mx-auto sm:max-w-lg lg:ml-0">
                <div className="flex flex-wrap items-start justify-between">
                  {logos.map((user) => (
                    <div key={user.title} className="flex justify-center px-1">
                      <a href={user.url}>
                        <img
                          style={{
                            filter:
                              "grayscale(100%) contrast(0.3) brightness(1.5)",
                          }}
                          className="h-9 sm:h-10 w-auto"
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
                {isAuthenticated ? <NewProjectForm /> : <PleaseSignIn />}
              </div>
              <div className="px-4 py-6 bg-gray-50 border-t-2 border-gray-200 sm:px-10">
                <p className="text-xs leading-5 text-gray-500">
                  <Trans ns="homepage">
                    By creating a project, you agree to our{" "}
                    <Link
                      to="/terms-of-use"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      Terms
                    </Link>
                    ,{" "}
                    <Link
                      to="/data-policy"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      Data Policy
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/cookies-policy"
                      className="font-medium text-gray-900 hover:underline"
                    >
                      Cookies Policy
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
  const { t, i18n } = useTranslation(["homepage"]);
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
              screen_hint: "signup",
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
          <span className="px-2 bg-white text-gray-500">Or</span>
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
