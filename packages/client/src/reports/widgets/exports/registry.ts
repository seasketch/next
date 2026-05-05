import type { WidgetExporter } from "./types";
import { exportGeographySizeTable } from "./exporters/geographySizeTable.export";
import {
  exportOverlappingAreasTable,
  exportFeatureCountTable,
  exportFeaturePresenceTable,
  exportRasterProportionTable,
} from "./exporters/classTableWidgets.export";
import { exportColumnStatisticsTable } from "./exporters/columnStatisticsTable.export";
import { exportColumnValuesHistogram } from "./exporters/columnValuesHistogram.export";
import { exportRasterStatisticsTable } from "./exporters/rasterStatisticsTable.export";
import { exportRasterValuesHistogram } from "./exporters/rasterValuesHistogram.export";
import { exportIntersectingFeaturesList } from "./exporters/intersectingFeaturesList.export";

const REGISTRY: Record<string, WidgetExporter> = {
  GeographySizeTable: exportGeographySizeTable,
  OverlappingAreasTable: exportOverlappingAreasTable,
  FeatureCountTable: exportFeatureCountTable,
  FeaturePresenceTable: exportFeaturePresenceTable,
  RasterProportionTable: exportRasterProportionTable,
  ColumnStatisticsTable: exportColumnStatisticsTable,
  ColumnValuesHistogram: exportColumnValuesHistogram,
  RasterStatisticsTable: exportRasterStatisticsTable,
  RasterValuesHistogram: exportRasterValuesHistogram,
  IntersectingFeaturesList: exportIntersectingFeaturesList,
};

export function getWidgetExporter(widgetType: string): WidgetExporter | undefined {
  return REGISTRY[widgetType];
}
