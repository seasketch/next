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
import { exportColumnSumTable } from "./exporters/columnSumTable.export";
import { exportRasterAreaCapturedTable } from "./exporters/rasterAreaCapturedTable.export";
import { exportClassCompositionChart } from "./exporters/classCompositionChart.export";
import { exportRasterTimeSeries } from "./exporters/rasterTimeSeries.export";
import { exportVectorTimeSeries } from "./exporters/vectorTimeSeries.export";
import { exportOusDemographicsTable } from "./exporters/ousDemographicsTable.export";

const REGISTRY: Record<string, WidgetExporter> = {
  GeographySizeTable: exportGeographySizeTable,
  OverlappingAreasTable: exportOverlappingAreasTable,
  FeatureCountTable: exportFeatureCountTable,
  FeaturePresenceTable: exportFeaturePresenceTable,
  RasterProportionTable: exportRasterProportionTable,
  RasterAreaCapturedTable: exportRasterAreaCapturedTable,
  ClassCompositionChart: exportClassCompositionChart,
  RasterTimeSeries: exportRasterTimeSeries,
  VectorTimeSeries: exportVectorTimeSeries,
  ColumnStatisticsTable: exportColumnStatisticsTable,
  ColumnValuesHistogram: exportColumnValuesHistogram,
  ColumnSumTable: exportColumnSumTable,
  RasterStatisticsTable: exportRasterStatisticsTable,
  RasterValuesHistogram: exportRasterValuesHistogram,
  IntersectingFeaturesList: exportIntersectingFeaturesList,
  OusDemographicsTable: exportOusDemographicsTable,
};

export function getWidgetExporter(
  widgetType: string
): WidgetExporter | undefined {
  return REGISTRY[widgetType];
}
