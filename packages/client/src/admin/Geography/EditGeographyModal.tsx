import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import {
  GeographyClippingSettingsDocument,
  useDeleteGeographyMutation,
  useUpdateGeographyMutation,
  useGeographyByIdQuery,
} from "../../generated/graphql";
import InputBlock from "../../components/InputBlock";
import TextInput from "../../components/TextInput";
import { useEffect, useMemo, useState } from "react";
import { name } from "mustache";
import useDialog from "../../components/useDialog";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";

export default function EditGeographyModal({
  onRequestClose,
  id,
}: {
  onRequestClose: () => void;
  id: number;
}) {
  const { data, loading, error } = useGeographyByIdQuery({
    variables: { id },
    fetchPolicy: "cache-and-network",
  });

  const onError = useGlobalErrorHandler();

  const [deleteMutation, deleteMutationState] = useDeleteGeographyMutation({
    refetchQueries: [GeographyClippingSettingsDocument],
    awaitRefetchQueries: true,
    onError,
  });

  const [updateGeographyMutation, updateGeographyMutationState] =
    useUpdateGeographyMutation({
      refetchQueries: [GeographyClippingSettingsDocument],
      awaitRefetchQueries: true,
      onError,
    });

  const { t } = useTranslation("admin:geography");
  const [state, setState] = useState<{ name: string }>({
    name: data?.geography?.name || "",
  });

  const hasChanges = useMemo(() => {
    return (
      state.name !== data?.geography?.name &&
      data?.geography?.name !== undefined &&
      data?.geography?.name !== null
    );
  }, [state, data?.geography]);

  useEffect(() => {
    if (data?.geography) {
      setState({
        name: data.geography.name || "",
      });
    }
  }, [data]);

  const dialog = useDialog();

  return (
    <Modal
      loading={loading}
      disableBackdropClick={
        hasChanges ||
        deleteMutationState.loading ||
        updateGeographyMutationState.loading
      }
      title={t("Edit Geography")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Save"),
          variant: "primary",
          loading: updateGeographyMutationState.loading,
          disabled:
            !hasChanges ||
            deleteMutationState.loading ||
            updateGeographyMutationState.loading,

          onClick: async () => {
            if (!state.name) {
              dialog.alert({
                message: t("Please enter a name for the geography."),
              });
              return;
            }
            await updateGeographyMutation({
              variables: {
                id,
                payload: {
                  name: state.name,
                },
              },
            });
            onRequestClose();
          },
        },
        {
          label: t("Cancel"),
          onClick: async () => {
            if (hasChanges) {
              const answer = await dialog.confirm(
                t("Are you sure you want to discard your changes?"),
                {
                  primaryButtonText: t("Discard changes"),
                }
              );
              if (answer) {
                onRequestClose();
              } else {
                return;
              }
            } else {
              onRequestClose();
            }
          },
          disabled:
            deleteMutationState.loading || updateGeographyMutationState.loading,
        },
        {
          label: t("Delete"),
          variant: "trash",
          loading: deleteMutationState.loading,
          disabled:
            deleteMutationState.loading || updateGeographyMutationState.loading,
          onClick: async () => {
            await dialog.confirmDelete({
              message: t("Are you sure you want to delete this geography?"),
              description: t(
                "This action cannot be undone. Related data layers will remain in the table of contents until you remove them."
              ),
              onDelete: async () => {
                await deleteMutation({
                  variables: { id },
                });
              },
            });
          },
        },
      ]}
    >
      <TextInput
        autocomplete="off"
        name="geography-name"
        description={t(
          "This name is visible within the administrative interface when configuring sketch classes, and used as a default label if this geography is used in reports."
        )}
        label={t("Name")}
        value={state.name}
        onChange={(val) => {
          setState((prev) => ({
            ...prev,
            name: val,
          }));
        }}
      />
    </Modal>
  );
}
