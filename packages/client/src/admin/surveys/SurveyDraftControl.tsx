/* eslint-disable i18next/no-literal-string */

import { CheckCircleIcon } from "@heroicons/react/solid";
import { useParams } from "react-router-dom";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  useSurveyByIdQuery,
  useUpdateSurveyDraftStatusMutation,
} from "../../generated/graphql";

export default function SurveyDraftControl({ id }: { id: number }) {
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const { data } = useSurveyByIdQuery({
    variables: {
      id,
    },
  });

  const isDraft =
    data?.survey?.isDisabled !== undefined ? data?.survey?.isDisabled : true;
  const [mutation, mutationState] = useUpdateSurveyDraftStatusMutation({
    onError,
    optimisticResponse: (data) => {
      return {
        __typename: "Mutation",
        updateSurvey: {
          __typename: "UpdateSurveyPayload",
          survey: {
            __typename: "Survey",
            id,
            isDisabled: data.isDisabled,
          },
        },
      };
    },
  });
  function setIsDraft(isDraft: boolean) {
    mutation({
      variables: {
        isDisabled: isDraft,
        id,
      },
    });
  }
  const url = `${window.location.protocol}//${window.location.host}/${slug}/surveys/${id}`;
  return (
    <fieldset className="max-w-2xl">
      <div className="mt-4 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:gap-x-4">
        {/* <!--
        Checked: "border-transparent", Not Checked: "border-gray-300"
        Active: "ring-2 ring-primary-500"
      --> */}
        <label
          onClick={() => setIsDraft(true)}
          className={`relative bg-white border ${
            isDraft ? "border-transparent" : "border-gray-300"
          } active:ring-2 active:ring-primary-500 rounded-lg shadow-sm p-4 flex cursor-pointer focus:outline-none`}
        >
          <input
            type="radio"
            name="project-type"
            value="Newsletter"
            className="sr-only"
            aria-labelledby="project-type-0-label"
            aria-describedby="project-type-0-description-0 project-type-0-description-1"
          />
          <div className="flex-1 flex">
            <div className="flex flex-col w-full">
              <span
                id="project-type-1-label"
                className={`block text-sm w-full font-medium flex align-middle ${
                  !isDraft ? "text-gray-500" : "text-gray-900"
                }`}
              >
                <span className="flex-1">Draft</span>
                <CheckCircleIcon
                  className={`ml-1 mr-1 h-5 w-5 text-primary-600 ${
                    !isDraft ? "invisible" : ""
                  }`}
                />
              </span>
              <span
                id="project-type-0-description-0"
                className="mt-1 flex items-center text-sm text-gray-500"
              >
                Only project administrators can access and configure this
                survey.
              </span>
            </div>
          </div>
          {/* <!--
          Active: "border", Not Active: "border-2"
          Checked: "border-primary-500", Not Checked: "border-transparent"
        --> */}
          <div
            onClick={() => setIsDraft(true)}
            className={`absolute -inset-px rounded-lg border-2 pointer-events-none active:border ${
              isDraft ? "border-primary-500" : "border-transparent"
            }`}
            aria-hidden="true"
          ></div>
        </label>

        {/* <!--
        Checked: "border-transparent", Not Checked: "border-gray-300"
        Active: "ring-2 ring-primary-500"
      --> */}
        <label
          onClick={() => setIsDraft(false)}
          className={`relative bg-white border rounded-lg shadow-sm p-4 flex cursor-pointer focus:outline-none`}
        >
          <input
            type="radio"
            name="project-type"
            value="Existing Customers"
            className="sr-only"
            aria-labelledby="project-type-1-label"
            aria-describedby="project-type-1-description-0 project-type-1-description-1"
          />
          <div className="flex-1 flex w-full">
            <div className="flex flex-col w-full">
              <span
                id="project-type-1-label"
                className={`block text-sm font-medium flex align-middle ${
                  isDraft ? "text-gray-500" : "text-gray-900"
                }`}
              >
                <span className="flex-1">Published</span>
                <CheckCircleIcon
                  className={`ml-1 mr-1 h-5 w-5 text-primary-600 ${
                    isDraft ? "invisible" : ""
                  }`}
                />
              </span>
              <span
                id="project-type-1-description-0"
                className="mt-1 flex items-center text-sm text-gray-500"
              >
                Send your potential respondents this link. Make sure your
                project is also public.
              </span>
              <a
                className={`text-sm underline truncate my-1 ${
                  isDraft && "text-gray-400 pointer-events-none"
                }`}
                href={url}
              >
                {url}
              </a>
              {/* <QRCode value={url} size={100} className="w-12" /> */}
            </div>
          </div>
          <div
            className={`absolute -inset-px rounded-lg border-2 pointer-events-none active:border ${
              !isDraft ? "border-primary-500" : "border-transparent"
            }`}
            aria-hidden="true"
          ></div>
        </label>
      </div>
    </fieldset>
  );
}
