import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { FullAdminOverlayFragment } from "../../../generated/graphql";
import EnableDataTables from "../EnableDataTables";
import RelatedDataTables from "./RelatedDataTables";
import DataTablesChangeLogList from "../../changelogs/DataTablesChangeLogList";

export default function DataTablesEditor({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  const { t } = useTranslation("admin:data");
  const layer = item.dataLayer;
  const source = layer?.dataSource;

  const geostatsLayer = useMemo(() => {
    const layers = source?.geostats?.layers || [];
    if (!layer) {
      return undefined;
    }
    return (
      layers.find((entry) =>
        layer.sourceLayer ? entry.layer === layer.sourceLayer : true
      ) || layers[0]
    );
  }, [layer, source?.geostats?.layers]);

  if (!layer || !geostatsLayer) {
    return (
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <Trans ns="admin:data">
            Data tables are not available for this layer type.
          </Trans>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <EnableDataTables
        item={item}
        geostatsLayer={geostatsLayer}
        aiBestIdColumnHint={source?.aiDataAnalystNote?.bestIdColumn}
        className="mt-5"
      />
      {item.enableDataTables && item.dataTableJoinColumn ? (
        <>
          <RelatedDataTables item={item} />
          <DataTablesChangeLogList tableOfContentsItemId={item.id} />
        </>
      ) : null}
    </div>
  );
}
