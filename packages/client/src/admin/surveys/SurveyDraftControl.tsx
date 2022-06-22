import { QrcodeIcon } from "@heroicons/react/outline";
import { CheckCircleIcon } from "@heroicons/react/solid";
import { useParams } from "react-router-dom";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Modal from "../../components/Modal";
import QRCode from "qrcode";
import {
  useSurveyByIdQuery,
  useUpdateSurveyDraftStatusMutation,
} from "../../generated/graphql";
import { useEffect, useState } from "react";
import { Trans } from "react-i18next";

export default function SurveyDraftControl({ id }: { id: number }) {
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const [qrOpen, setQROpen] = useState(false);
  const { data } = useSurveyByIdQuery({
    variables: {
      id,
    },
  });

  const isDraft =
    data?.survey?.isDisabled !== undefined ? data?.survey?.isDisabled : true;
  const [mutation] = useUpdateSurveyDraftStatusMutation({
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
  // eslint-disable-next-line i18next/no-literal-string
  const url = `${window.location.protocol}//${window.location.host}/${slug}/surveys/${id}`;
  const [qr, setQR] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url).then((v) => setQR(v));
  }, [url]);

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
                className={`text-sm w-full font-medium flex align-middle ${
                  !isDraft ? "text-gray-500" : "text-gray-900"
                }`}
              >
                <span className="flex-1">
                  <Trans ns="admin:surveys">Draft</Trans>
                </span>
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
                <Trans ns="admin:surveys">
                  Only project administrators can access and configure this
                  survey.
                </Trans>
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
                className={`text-sm font-medium flex align-middle ${
                  isDraft ? "text-gray-500" : "text-gray-900"
                }`}
              >
                <span className="flex-1">
                  <Trans ns="admin:surveys">Published</Trans>
                </span>
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
                <Trans ns="admin:surveys">
                  Send your potential respondents this link.
                </Trans>
              </span>
              <div
                className={`flex w-full align-middle justify-center my-2 ${
                  isDraft && "text-gray-400 pointer-events-none"
                }`}
              >
                <QrcodeIcon
                  onClick={() => setQROpen(true)}
                  className="w-5 h-5 mr-1"
                />
                <a className={`text-sm underline flex-1 truncate`} href={url}>
                  {url}
                </a>
              </div>
            </div>
          </div>
          <div
            className={`absolute -inset-px rounded-lg border-2 pointer-events-none active:border ${
              !isDraft ? "border-primary-500" : "border-transparent"
            }`}
            aria-hidden="true"
          ></div>
        </label>
        <Modal
          open={qrOpen}
          onRequestClose={() => setQROpen(false)}
          zeroPadding={true}
        >
          <div className="m-2 flex flex-col justify-center align-middle">
            <img
              alt="qr code"
              src={qr}
              onClick={() => downloadURI(qr, "seasketch-survey-qr-code")}
            />
            <p className="text-sm text-center">
              <Trans ns="admin:surveys">click to download</Trans>
            </p>
          </div>
        </Modal>
      </div>
    </fieldset>
  );
}

function downloadURI(uri: string, name: string) {
  var link = document.createElement("a");
  link.download = name;
  link.href = uri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
