import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import {
  AdminOverlayFragment,
  OverlayFragment,
  ProjectBackgroundJobState,
  ProjectBackgroundJobType,
  useConvertFeatureLayerToHostedMutation,
} from "../../generated/graphql";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import { useContext } from "react";
import { ProjectBackgroundJobContext } from "../uploads/ProjectBackgroundJobContext";
import { BackgroundJobListItem } from "./BackgroundJobList";

export default function ConvertFeatureLayerToHostedBlock({
  item,
}: {
  item: Pick<
    AdminOverlayFragment,
    "id" | "dataSourceType" | "projectBackgroundJobs"
  >;
}) {
  const context = useContext(ProjectBackgroundJobContext);
  const onError = useGlobalErrorHandler();
  const [mutate, state] = useConvertFeatureLayerToHostedMutation({
    variables: {
      tocId: item.id,
    },
    onError,
  });
  const { t } = useTranslation("admin:data");
  return (
    <>
      {" "}
      <h3 className="font-medium">
        <Trans ns="admin:Data">Host on SeaSketch</Trans>
      </h3>
      <p className="font-normal">
        <Trans ns="admin:data">
          SeaSketch can extract vector data from this service and host it on our
          servers for better performance and access to additional features such
          as our styling tools. The conversion process may take a few minutes
          and will operate in the background.
        </Trans>
      </p>
      <button
        className={`text-sm mt-2 px-1.5 py-1 border-gray-300 bg-white border shadow-sm text-black rounded ${
          (item.projectBackgroundJobs || []).filter(
            (j) => j.type === ProjectBackgroundJobType.ArcgisImport
          ).length > 0
            ? "opacity-50 cursor-default"
            : ""
        }`}
        disabled={
          (item.projectBackgroundJobs || []).filter(
            (j) => j.type === ProjectBackgroundJobType.ArcgisImport
          ).length > 0
        }
        onClick={() => mutate()}
      >
        {t("Convert to SeaSketch hosted layer")}
      </button>
      {context.manager &&
        (item.projectBackgroundJobs || []).filter(
          (j) => j.state !== ProjectBackgroundJobState.Complete
        )?.length > 0 && (
          <ul className="pt-3">
            {(item.projectBackgroundJobs || [])
              .filter((j) => j.type === ProjectBackgroundJobType.ArcgisImport)
              .map((job) => (
                <BackgroundJobListItem
                  key={job.id}
                  job={job}
                  manager={context.manager}
                  className="shadow-none border"
                />
              ))}
          </ul>
        )}
    </>
  );
}
