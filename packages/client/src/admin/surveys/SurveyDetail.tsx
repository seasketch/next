import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import useProjectId from "../../useProjectId";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  ChevronLeftIcon,
  LinkIcon,
  PencilIcon,
} from "@heroicons/react/outline";
import { Link } from "react-router-dom";
import { useSurveyByIdQuery } from "../../generated/graphql";
import Spinner from "../../components/Spinner";

export default function SurveyDetail({ surveyId }: { surveyId: number }) {
  const projectId = useProjectId();
  const { t } = useTranslation("admin:surveys");
  const onError = useGlobalErrorHandler();
  const { data, loading, error } = useSurveyByIdQuery({
    variables: {
      id: surveyId,
    },
  });
  const survey = data?.survey;
  // eslint-disable-next-line i18next/no-literal-string
  const publicUrl = `https://s.seasket.ch/${surveyId}`;
  return (
    <div className="flex flex-col min-h-full">
      <div className="pb-5">
        <nav
          className="flex items-start px-4 py-3 sm:px-6 lg:px-8"
          aria-label="Breadcrumb"
        >
          <Link
            to="./"
            className="inline-flex items-center space-x-3 text-sm font-medium text-gray-500"
          >
            <ChevronLeftIcon
              className="-ml-2 h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
            <span>{t("Survey List")}</span>
          </Link>
        </nav>
        {survey && (
          <>
            <h1 className="text-gray-900 text-3xl font-bold px-4 py-1 sm:px-6 lg:px-8">
              {survey.name}
            </h1>
            <div className="px-4 py-1 sm:px-6 lg:px-8">
              <a
                onClick={(e) => {
                  if (survey.isDisabled) {
                    e.preventDefault();
                    alert(
                      t("Survey must be published before sharing this link")
                    );
                  }
                }}
                className={`text-gray-500 text-sm underline ${
                  survey.isDisabled && "cursor-not-allowed"
                }`}
                href={publicUrl}
              >
                <LinkIcon className="mr-1 -mt-0.5 h-5 w-5 inline" />
                {publicUrl}
              </a>
            </div>
            <div className="mt-3 flex px-4 py-1 sm:px-6 lg:px-8">
              <span className="">
                {/* <button
                type="button"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-purple-500"
              >
                <PencilIcon
                  className="-ml-1 mr-2 h-5 w-5 text-gray-400"
                  aria-hidden="true"
                />
                {t("Edit Form")}
              </button> */}
                <Button
                  href={`../../survey-editor/${data.survey?.id}`}
                  label={
                    <>
                      <PencilIcon className="-ml-1 mr-2 h-5 w-5 text-gray-400" />
                      {t("Edit Form")}
                    </>
                  }
                />
              </span>
            </div>
          </>
        )}
      </div>
      <div className="flex-1 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <h2 className="text-xl">{t("Survey Responses")}</h2>
        <FakeTabs
          tabs={[
            {
              name: "All",
              count: survey?.submittedResponseCount || 0,
              href: "#",
              current: true,
            },
            {
              name: "For Review",
              count: 3,
              href: "#",
              current: false,
            },
            {
              name: "Practice",
              count: 2,
              href: "#",
              current: false,
            },
            {
              name: "Map",
              href: "#",
              current: false,
            },
          ]}
        />
      </div>
      {!survey && <Spinner />}
    </div>
  );
}

function FakeTabs({
  tabs,
}: {
  tabs: { current: boolean; name: string; href: string; count?: number }[];
}) {
  return (
    <>
      <div className="sm:hidden">
        <label htmlFor="tabs" className="sr-only">
          {
            // eslint-disable-next-line i18next/no-literal-string
            "Select a tab"
          }
        </label>
        {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
        <select
          id="tabs"
          name="tabs"
          className="mt-4 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
          defaultValue={tabs.find((tab) => tab.current)!.name}
        >
          {tabs.map((tab) => (
            <option key={tab.name}>{tab.name}</option>
          ))}
        </select>
      </div>
      <div className="hidden sm:block">
        <div className="border-b border-gray-200">
          <nav className="mt-2 -mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <a
                key={tab.name}
                href={tab.href}
                className={`${
                  tab.current
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200"
                },
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {tab.name}
                {tab.count ? (
                  <span
                    className={`${
                      tab.current
                        ? "bg-blue-100 text-primary-600"
                        : "bg-gray-100 text-gray-900"
                    }
                      hidden ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block`}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
