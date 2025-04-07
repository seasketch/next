import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { useEffect, useMemo, useState } from "react";
import Switch from "../../components/Switch";
import {
  useEezLayerQuery,
  UserProfileDetailsFragment,
  useUpdateLandClippingSettingsMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import InlineAuthorDetails from "../../projects/Forums/InlineAuthorDetails";
import InlineAuthor from "../../components/InlineAuthor";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Select from "react-select";
import useEEZChoices from "./useEEZChoices";

export default function EEZClippingModal({
  onRequestClose,
  enabled,
  lastUpdated,
  author,
  selectedEEZs,
  onRequestEEZPicker,
}: {
  onRequestClose: () => void;
  enabled: boolean;
  lastUpdated: Date;
  author: UserProfileDetailsFragment;
  selectedEEZs?: string[];
  onRequestEEZPicker?: () => void;
}) {
  const { t } = useTranslation("admin:geography");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useEezLayerQuery({ onError });
  const [state, setState] = useState<{
    enabled: boolean;
    selectedEEZs: string[];
    hasChanges: boolean;
  }>({ enabled, selectedEEZs: selectedEEZs || [], hasChanges: false });
  const [mutation, mutationState] = useUpdateLandClippingSettingsMutation();

  return (
    <Modal
      disableBackdropClick={mutationState.loading || state.hasChanges}
      title={t("Exclusive Economic Zone (EEZ) Clipping")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Cancel"),
          disabled: mutationState.loading,
          onClick: onRequestClose,
        },
        {
          label: t("Save"),
          variant: "primary",
          disabled: mutationState.loading || state.hasChanges,
          loading: mutationState.loading,
          onClick: async () => {
            // save state
            // await mutation({
            //   variables: { enable: state, slug: getSlug() },
            // });
            onRequestClose();
          },
        },
      ]}
    >
      <p className="text-sm w-full flex items-center space-x-4 pb-5 pt-1">
        <Switch
          disabled={!Boolean(selectedEEZs?.length)}
          isToggled={state.enabled}
          onClick={(val) =>
            setState((prev) => ({
              ...prev,
              enabled: val,
              hasChanges: true, // enable save button
            }))
          }
        />
        <label className="flex space-x-2">
          <span>{t("Limit to")}</span>
          <span className="italic flex-1 truncate">
            {(selectedEEZs || []).join(", ")}
          </span>
          <button
            className="mx-4 text-primary-500"
            onClick={onRequestEEZPicker}
          >
            {t("change choices")}
          </button>
        </label>
      </p>

      <p className="text-sm">
        <Trans ns="admin:geography">
          SeaSketch maintains a copy of the{" "}
          <a
            target="_blank"
            className="underline"
            href="https://daylightmap.org/coastlines.html"
          >
            MarineRegions EEZ dataset
          </a>{" "}
          which can be used to limit the planning units to those within the
          chosen Exclusive Economic Zones (EEZs).
        </Trans>
      </p>
      <p className="flex items-center py-2 text-sm space-x-2">
        <span>
          <Trans ns="admin:geography">
            Layer last updated {lastUpdated.toLocaleDateString()} by{" "}
          </Trans>
        </span>
        <InlineAuthor profile={author} />
      </p>
    </Modal>
  );
}
