import { useTranslation, Trans } from "react-i18next";
import Modal from "../../components/Modal";
import {
  PublishedTableOfContentsDocument,
  usePublishTableOfContentsMutation,
} from "../../generated/graphql";
import useProjectId from "../../useProjectId";

export default function PublishTableOfContentsModal(props: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const [publish, publishState] = usePublishTableOfContentsMutation({
    refetchQueries: [PublishedTableOfContentsDocument],
  });
  const projectId = useProjectId();
  return (
    <Modal
      title={t("Publish Overlays")}
      onRequestClose={props.onRequestClose}
      footer={[
        {
          autoFocus: true,
          label: t("Publish"),
          disabled: publishState.loading,
          loading: publishState.loading,
          variant: "primary",
          onClick: async () => {
            await publish({
              variables: {
                projectId: projectId!,
              },
            })
              .then((val) => {
                if (!val.errors) {
                  props.onRequestClose();
                }
              })
              .catch((e) => {
                console.error(e);
              });
          },
        },
        {
          label: t("Cancel"),
          onClick: props.onRequestClose,
        },
      ]}
    >
      <p>
        <Trans ns={["admin"]}>
          Published layer lists include all authorization settings, data layer
          and source changes, and z-ordering specifications. Once published,
          project users will have access to the new list upon reloading the
          page. Edits to the overlay list from the administrator page will not
          be available to end-users until they are published.
        </Trans>
      </p>
      {publishState.error && (
        <p className="text-red-800 mt-4">
          Error: ${publishState.error.message}
        </p>
      )}
    </Modal>
  );
}
