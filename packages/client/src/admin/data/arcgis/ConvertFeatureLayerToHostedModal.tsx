import { useContext } from "react";
import { ProjectBackgroundJobContext } from "../../uploads/ProjectBackgroundJobContext";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import {
  ProjectBackgroundJobState,
  ProjectBackgroundJobType,
  useConvertFeatureLayerToHostedMutation,
  useDismissFailedJobMutation,
  useGetLayerItemQuery,
} from "../../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../../../components/Modal";
import { BackgroundJobListItem } from "../BackgroundJobList";

export default function ConvertFeatureLayerToHostedModal({
  tocId,
  onRequestClose,
}: {
  tocId: number;
  onRequestClose: () => void;
}) {
  const context = useContext(ProjectBackgroundJobContext);
  const onError = useGlobalErrorHandler();
  const [dismiss] = useDismissFailedJobMutation();
  const [mutate, state] = useConvertFeatureLayerToHostedMutation({
    variables: {
      tocId,
    },
    onError,
  });
  const { data, loading } = useGetLayerItemQuery({
    onError,
    variables: {
      id: tocId,
    },
  });
  const item = data?.tableOfContentsItem;
  const { t } = useTranslation("admin:data");
  return (
    <Modal
      footer={[
        {
          label: "Close",
          onClick: onRequestClose,
        },
        {
          label: t("Convert to SeaSketch hosted layer"),
          onClick: async () => {
            // first, dismiss any existing jobs
            const failedJobs = (item?.projectBackgroundJobs || []).filter(
              (j) =>
                j.state === ProjectBackgroundJobState.Failed &&
                j.type === ProjectBackgroundJobType.ArcgisImport
            );
            await Promise.all(
              failedJobs.map((j) => dismiss({ variables: { id: j.id } }))
            );
            await mutate();
            onRequestClose();
          },
          disabled:
            (item?.projectBackgroundJobs || []).filter(
              (j) =>
                j.type === ProjectBackgroundJobType.ArcgisImport &&
                j.state !== ProjectBackgroundJobState.Complete &&
                j.state !== ProjectBackgroundJobState.Failed
            ).length > 0,
          variant: "primary",
        },
      ]}
      loading={loading}
      open={true}
      onRequestClose={() => onRequestClose()}
      title={t("Convert to SeaSketch hosted layer")}
    >
      {item && (
        <>
          <p className="font-normal">
            <Trans ns="admin:data">
              SeaSketch can extract vector data from this service and host it on
              our servers for better performance and access to additional
              features such as our styling tools. The conversion process may
              take a few minutes and will operate in the background.
            </Trans>
          </p>
          {(data.tableOfContentsItem?.projectBackgroundJobs || []).filter(
            (j) =>
              j.state === ProjectBackgroundJobState.Queued ||
              j.state === ProjectBackgroundJobState.Running
          ).length > 0 && (
            <p className="mt-4">
              <Trans ns="admin:data">
                This layer is currently being converted to a SeaSketch hosted
                layer. Feel free to close this dialog or you browser tab and
                check back later.
              </Trans>
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
