import React from "react";
import ModalDeprecated from "../../components/ModalDeprecated";
import { useTranslation, Trans } from "react-i18next";
import Button from "../../components/Button";
import { usePublishTableOfContentsMutation } from "../../generated/graphql";
import useProjectId from "../../useProjectId";

export default function PublishTableOfContentsModal(props: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation(["admin"]);
  const [publish, publishState] = usePublishTableOfContentsMutation();
  const projectId = useProjectId();
  return (
    <ModalDeprecated
      open={true}
      title={t("Publish Overlays")}
      footer={
        <div>
          <Button
            className="mr-2"
            label={t("Cancel")}
            onClick={props.onRequestClose}
          />
          <Button
            primary
            label={t("Publish")}
            loading={publishState.loading}
            onClick={() => {
              publish({
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
            }}
          />
        </div>
      }
    >
      <div className="max-w-lg">
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
      </div>
    </ModalDeprecated>
  );
}
