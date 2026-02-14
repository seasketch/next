import type { AnyLayer, AnySourceData } from "mapbox-gl";

export type ReportMapStyle = {
  sources: { [id: string]: AnySourceData };
  layers: AnyLayer[];
};
