import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NewProjectCTA() {
  const { t, i18n } = useTranslation(["homepage"]);
  return (
    <div className="bg-gray-50">
      <div className="max-w-screen-xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
        <h2 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10">
          {t("Ready to dive in?")}
          <br />
          <span className="text-primary-500">
            {t("Create your own SeaSketch project.")}
          </span>
        </h2>
        <div className="mt-8 flex lg:flex-shrink-0 lg:mt-0">
          <div className="inline-flex rounded-md shadow">
            <Link
              to="/new-project"
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
              id="get-started"
            >
              {t("Get started")}
            </Link>
          </div>
          <div className="ml-3 inline-flex rounded-md shadow">
            <Link
              to="/team"
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-secondary-500 bg-white  focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
              id="learn-more"
            >
              {t("Learn more")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
