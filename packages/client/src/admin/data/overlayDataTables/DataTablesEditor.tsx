import { useMemo } from "react";
import { Trans } from "react-i18next";
import { GeostatsLayer } from "@seasketch/geostats-types";
import { FullAdminOverlayFragment } from "../../../generated/graphql";
import EnableDataTables from "../EnableDataTables";
import RelatedDataTables from "./RelatedDataTables";
import DataTablesChangeLogList from "../../changelogs/DataTablesChangeLogList";
import { useRegisterDropTarget } from "../../uploads/DataAdminDropTargetContext";
import { DROP_TARGET_PRIORITY } from "../../uploads/dropTargets";

export default function DataTablesEditor({
  item,
}: {
  item: FullAdminOverlayFragment;
}) {
  const layer = item.dataLayer;
  const source = layer?.dataSource;

  const tablesReady = Boolean(
    item.enableDataTables && item.dataTableJoinColumn
  );
  useRegisterDropTarget({
    id: "data-tables-not-ready",
    priority: DROP_TARGET_PRIORITY.editorTab,
    intent: { kind: "blocked" },
    enabled: !tablesReady,
  });

  const geostatsLayer: GeostatsLayer | undefined = useMemo(() => {
    const layers = (source?.geostats?.layers || []) as GeostatsLayer[];
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
