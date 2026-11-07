import { useContext, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import {
  DraftTableOfContentsDocument,
  useCreateGfwTableOfContentsItemMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import { gfwCreateParams } from "../../dataLayers/gfwEffort";

export default function AddGfwLayerModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const { manager } = useContext(MapManagerContext);
  const translatedTitle = t("Fishing effort");
  const [title, setTitle] = useState(
    typeof translatedTitle === "string" ? translatedTitle : ""
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createLayer, state] = useCreateGfwTableOfContentsItemMutation({
    onError,
    refetchQueries: [DraftTableOfContentsDocument],
    awaitRefetchQueries: true,
  });

  const save = () => {
    const titleText = title.trim();
    if (!titleText) {
      setSaveError(t("Enter a title for this layer."));
      return;
    }
    setSaveError(null);
    createLayer({
      variables: {
        slug: getSlug(),
        title: titleText,
        params: gfwCreateParams(),
        metadata: null,
      },
    })
      .then((response) => {
        const stableId =
          response.data?.createGfw4WingsTableOfContentsItem?.tableOfContentsItem
            ?.stableId;
        if (stableId && manager) {
          manager.showTocItems([stableId]);
        }
        onRequestClose();
      })
      .catch(() => {
        setSaveError(
          t("There was a problem saving this fishing-effort layer. Please try again.")
        );
      });
  };

  return (
    <Modal
      title={t("Global Fishing Watch")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Cancel"),
          onClick: onRequestClose,
          variant: "secondary",
        },
        {
          label: t("Add layer"),
          onClick: save,
          variant: "primary",
          loading: state.loading,
          disabled: state.loading,
        },
      ]}
    >
      <div className="space-y-3 text-sm">
        <p>
          <Trans ns="admin:data">
            Adds annual apparent fishing effort, in hours, from 2012 through
            the current year. The time slider repaints the same tiles: one
            year, a running total, or a range of years. The current year is
            incomplete.
          </Trans>
        </p>
        <p>
          <Trans ns="admin:data">
            Powered by{" "}
            <a
              href="https://globalfishingwatch.org"
              target="_blank"
              rel="noreferrer"
            >
              Global Fishing Watch
            </a>
            .
          </Trans>
        </p>
        <label className="block space-y-1">
          <span className="font-medium">{t("Title")}</span>
          <input
            className="w-full rounded border px-2 py-1"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        {saveError ? <p className="text-red-700">{saveError}</p> : null}
      </div>
    </Modal>
  );
}
