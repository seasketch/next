import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  FullAdminOverlayFragment,
  useUpdateDataTablesSettingsMutation,
} from "../../generated/graphql";
import { GeostatsLayer } from "@seasketch/geostats-types";
import Switch from "../../components/Switch";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";
import DataTableJoinColumnModal from "./overlayDataTables/DataTableJoinColumnModal";

export default function EnableDataTables({
  className,
  item,
  geostatsLayer,
  aiBestIdColumnHint,
}: {
  className?: string;
  item: Pick<
    FullAdminOverlayFragment,
    "id" | "enableDataTables" | "dataTableJoinColumn"
  >;
  geostatsLayer: GeostatsLayer | undefined;
  aiBestIdColumnHint?: string | null;
}) {
  const { t } = useTranslation("admin:data");
  const [modalOpen, setModalOpen] = useState(false);
  const [updateSettings, updateSettingsState] =
    useUpdateDataTablesSettingsMutation();

  const saveSettings = async (
    enableDataTables: boolean,
    dataTableJoinColumn?: string | null
  ) => {
    await updateSettings({
      variables: {
        id: item.id,
        enableDataTables,
        dataTableJoinColumn,
      },
      refetchQueries: [...layerSettingsChangeLogRefetchQueries(item.id)],
    });
  };

  const onToggle = () => {
    if (item.enableDataTables) {
      saveSettings(false, item.dataTableJoinColumn);
      return;
    }
    setModalOpen(true);
  };

  const openJoinColumnModal = () => setModalOpen(true);

  return (
    <>
      <div className={className}>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">
                <Trans ns="admin:data">Enable Data Tables</Trans>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                <Trans ns="admin:data">
                  Attach multidimensional data about features in this layer
                  using a shared ID column. Great for monitoring data. For
                  example, add annual species observations for survey sites.
                </Trans>
              </p>
            </div>
            <Switch
              isToggled={Boolean(item.enableDataTables)}
              disabled={updateSettingsState.loading}
              onClick={onToggle}
            />
          </div>

          {item.enableDataTables && item.dataTableJoinColumn ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
              <span className="text-xs font-medium text-gray-500">
                {t("Overlay join column")}
              </span>
              <button
                type="button"
                className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-primary-700 hover:bg-primary-50 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                onClick={openJoinColumnModal}
                aria-label={t("Change overlay join column")}
              >
                {item.dataTableJoinColumn}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {modalOpen ? (
        <DataTableJoinColumnModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          geostatsLayer={geostatsLayer}
          aiBestIdColumnHint={aiBestIdColumnHint}
          initialJoinColumn={item.dataTableJoinColumn}
          saving={updateSettingsState.loading}
          onSave={async (joinColumn) => {
            await saveSettings(true, joinColumn);
            setModalOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
