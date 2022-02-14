import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../../components/InputBlock";
import Modal from "../../components/Modal";
import Switch from "../../components/Switch";
import { FormElementDetailsFragment } from "../../generated/graphql";

export default function ExportResponsesModal({
  surveyId,
  open,
  spatialFormElements,
  onRequestClose,
  onRequestData,
}: {
  open: boolean;
  surveyId: number;
  spatialFormElements: FormElementDetailsFragment[];
  onRequestClose?: () => void;
  onRequestData: (includePractice: boolean) => string;
}) {
  const { t } = useTranslation("admin:surveys");
  const [includePractice, setIncludePractice] = useState(false);
  return (
    <Modal
      open={open}
      title={t("Export Responses")}
      onRequestClose={onRequestClose}
    >
      <h4 className="text-lg py-1">
        <Trans ns="admin:surveys">Response Data</Trans>
      </h4>
      <p>
        <Trans ns="admin:surveys">
          Most response data is available in a single CSV file.
        </Trans>
      </p>
      <p>
        <button
          className="text-primary-500 underline"
          onClick={() => {
            const dataForExport = onRequestData(includePractice);
            download(dataForExport, "responses.csv", "text/csv");
          }}
        >
          {
            // eslint-disable-next-line i18next/no-literal-string
            "responses.csv"
          }
        </button>
      </p>
      <InputBlock
        className="mt-3"
        title={t("Include Practice Responses")}
        input={
          <Switch isToggled={includePractice} onClick={setIncludePractice} />
        }
      />
      <h4 className="text-lg py-1 mt-2">
        <Trans ns="admin:surveys">Spatial Data</Trans>
      </h4>
      <p>
        <Trans ns="admin:surveys">
          Each spatial input element is exported as a collection.
        </Trans>
      </p>
      {spatialFormElements.map((element) => (
        <div key={element.id}>
          <a
            className="text-primary-500 underline"
            download={
              // eslint-disable-next-line i18next/no-literal-string
              `${element.exportId!}.geojson.json`
            }
            href={`${process.env.REACT_APP_GRAPHQL_ENDPOINT!.replace(
              "/graphql",
              `/export-survey/${surveyId}/spatial/${
                element.id
              }/geojson?filename=${element.exportId!}.geojson.json`
            )}`}
          >
            {
              // eslint-disable-next-line i18next/no-literal-string
              `${element.exportId!}.geojson.json`
            }
          </a>
        </div>
      ))}
    </Modal>
  );
}

var download = function (content: string, fileName: string, mimeType: string) {
  var a = document.createElement("a");
  mimeType = mimeType || "application/octet-stream";

  // @ts-ignore
  if (navigator.msSaveBlob) {
    // IE10
    // @ts-ignore
    navigator.msSaveBlob(
      new Blob([content], {
        type: mimeType,
      }),
      fileName
    );
  } else if (URL && "download" in a) {
    //html5 A[download]
    a.href = URL.createObjectURL(
      new Blob([content], {
        type: mimeType,
      })
    );
    a.setAttribute("download", fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.location.href =
      "data:application/octet-stream," + encodeURIComponent(content); // only this mime type is supported
  }
};
