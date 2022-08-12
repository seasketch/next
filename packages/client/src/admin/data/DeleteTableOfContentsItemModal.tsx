import React, { useState } from "react";
import Button from "../../components/Button";
import ModalDeprecated from "../../components/ModalDeprecated";
import { ClientTableOfContentsItem } from "../../dataLayers/tableOfContents/TableOfContents";
import { useDeleteBranchMutation } from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";

export default function DeleteTableOfContentsItemModal(props: {
  item?: ClientTableOfContentsItem;
  onRequestClose?: () => void;
  onDelete?: () => void;
}) {
  const [mutation] = useDeleteBranchMutation();
  const { t } = useTranslation("admin");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<Error>();
  const onRequestClose = () => {
    if (!deleting && props.onRequestClose) {
      setError(undefined);
      props.onRequestClose();
    }
  };
  return (
    <ModalDeprecated
      onRequestClose={onRequestClose}
      open={!!props.item}
      footer={
        <>
          <Button
            disabled={deleting}
            onClick={onRequestClose}
            className="mr-2"
            label={t("Cancel")}
          />
          <Button
            disabled={deleting}
            autofocus={true}
            primary={true}
            // buttonClassName={"ring ring-red-300"}
            loading={deleting}
            onClick={async () => {
              setError(undefined);
              setDeleting(true);
              try {
                await mutation({
                  variables: {
                    id: props.item!.id as number,
                  },
                });
                if (props.onDelete) {
                  await props.onDelete();
                }
                setDeleting(false);
                onRequestClose();
              } catch (e) {
                setError(e);
                setDeleting(false);
              }
            }}
            label={t("Delete")}
          />
        </>
      }
    >
      <h2 className="text-lg font-semibold">
        <Trans ns="admin">Delete</Trans> {props.item?.title}
      </h2>
      <div className="mt-2 text-md text-gray-500">
        <p>
          {props.item?.isFolder ? (
            <Trans ns="admin">
              Are you sure you want to delete this folder? Items contained will
              also be deleted.
            </Trans>
          ) : (
            <Trans ns="admin">
              Are you sure you want to delete this layer?
            </Trans>
          )}
        </p>
        {/* eslint-disable-next-line */}
        {error && <p className="text-red-900 mt-2">Error: {error.message}</p>}
      </div>
    </ModalDeprecated>
  );
}
