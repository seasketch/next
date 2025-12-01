import { useTranslation } from "react-i18next";
import { ReportCardConfigUpdateCallback } from "../registerCard";
import { useContext, useMemo } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { useCardLocalizedStringAdmin } from "./cards";
import Switch from "../../components/Switch";
import AreaUnitSelect from "../components/AreaUnitSelect";
import LengthUnitSelect from "../components/LengthUnitSelect";
import CollapsibleFooterAdmin from "../components/CollapsibleFooterAdmin";
import MapLayerVisibilityControlsAdmin from "../components/MapLayerVisibilityControlsAdmin";
import SortSelect from "../components/SortSelect";
import { GeostatsLayer, isRasterInfo } from "@seasketch/geostats-types";
import { AreaDisplayUnit, LengthDisplayUnit } from "../hooks/useUnits";
import { OverlappingAreasCardConfiguration } from "./OverlappingAreasCard";
import BufferDistanceField from "../components/BufferDistanceField";

// Restricted length units for overlap measurements (only km and mi supported)
type OverlapLengthUnit = "km" | "mi";

type AdminConfig = OverlappingAreasCardConfiguration;

/**
 * Helper function to determine if a geometry type is a polygon type
 */
function isPolygonGeometry(geometry: string): boolean {
  return geometry === "Polygon" || geometry === "MultiPolygon";
}

export default function OverlappingAreasCardAdmin({
  config,
  onUpdate,
}: {
  config: AdminConfig;
  onUpdate: ReportCardConfigUpdateCallback;
}) {
  const { t } = useTranslation("admin:sketching");
  useContext(FormLanguageContext);
  const rawUnit = config.componentSettings?.unit;
  const areaUnitValue: AreaDisplayUnit =
    rawUnit === "mi" || rawUnit === "acres" || rawUnit === "ha"
      ? rawUnit
      : "km";
  const lengthUnitValue: OverlapLengthUnit = rawUnit === "mi" ? "mi" : "km";
  const sortBy = config.componentSettings?.sortBy ?? "overlap";
  const { updateComponentSettings } = useCardLocalizedStringAdmin(
    config,
    onUpdate
  );

  const updateSettings = (
    newSettings: Partial<NonNullable<AdminConfig["componentSettings"]>>
  ) => {
    updateComponentSettings(newSettings);
  };

  const handleAreaUnitChange = (unit: AreaDisplayUnit) => {
    updateSettings({ unit });
  };

  const handleLengthUnitChange = (unit: LengthDisplayUnit) => {
    const normalizedUnit: OverlapLengthUnit = unit === "mi" ? "mi" : "km";
    updateSettings({ unit: normalizedUnit });
  };

  // Determine geometry type from the first reporting layer's geostats metadata
  const geometryType = useMemo(() => {
    if (config.reportingLayers.length === 0) return null;
    const firstLayer = config.reportingLayers[0];
    const meta =
      firstLayer.tableOfContentsItem?.dataLayer?.dataSource?.geostats;
    if (!meta || isRasterInfo(meta)) return null;
    const geostats = meta.layers[0] as GeostatsLayer;
    return geostats.geometry;
  }, [config.reportingLayers]);

  // Determine if this is a polygon or line layer
  const isPolygonLayer = geometryType ? isPolygonGeometry(geometryType) : true; // Default to polygon/area for backwards compatibility

  let multipeCategories =
    config.reportingLayers.some((l) => l.layerParameters?.groupBy) ||
    config.reportingLayers.length > 1;
  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-gray-900">
          {t("Display Units")}
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {isPolygonLayer
            ? t("Choose the unit used to display area values.")
            : t("Choose the unit used to display length values.")}
        </p>
        <div className="mt-2">
          {isPolygonLayer ? (
            <AreaUnitSelect
              value={areaUnitValue}
              onChange={handleAreaUnitChange}
            />
          ) : (
            <LengthUnitSelect
              value={lengthUnitValue}
              onChange={handleLengthUnitChange}
            />
          )}
        </div>
      </div>

      <SortSelect
        value={sortBy}
        onChange={(value) => updateSettings({ sortBy: value })}
        options={[
          { value: "overlap", labelKey: "by amount" },
          { value: "name", labelKey: "by name" },
        ]}
        descriptionKey="Choose how to order categories in the list."
      />

      {multipeCategories && (
        <div className="mt-3 flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">
              {t("Show all categories")}
            </label>
            <p className="text-xs text-gray-500">
              {t("Include categories even if there is no overlap.")}
            </p>
          </div>
          <Switch
            isToggled={Boolean(
              config.componentSettings?.showZeroOverlapCategories
            )}
            onClick={(enabled: boolean) =>
              updateSettings({ showZeroOverlapCategories: enabled })
            }
          />
        </div>
      )}

      <BufferDistanceField
        value={config.componentSettings?.bufferMeters}
        onChange={(value) =>
          updateSettings({
            bufferMeters:
              typeof value === "number" && value > 0 ? value : undefined,
          })
        }
        label={t("Apply Buffer")}
        description={t(
          "Grows the sketch by the specified distance in meters before measuring overlap."
        )}
      />

      <MapLayerVisibilityControlsAdmin config={config} onUpdate={onUpdate} />

      <CollapsibleFooterAdmin config={config} onUpdate={onUpdate} />
    </div>
  );
}
