export interface SeaSketchDataSource {
  /** uuid */
  id: string;
  originalSource: {
    /** url not available for uploads */
    url?: string;
    type:
      | "arcgis-dynamic-mapservice"
      | "arcgis-feature-layer"
      | "arcgis-tiled-mapservice"
      | "upload";
    /** best service name or upload file name and extension */
    name: string;
  };
  type:
    | "ArcGISDynamicMapServer"
    | "ArcGISVectorSource"
    | "mvt"
    | "geojson"
    | "geobuf"
    | "image"
    | "raster"
    | "raster-dem"
    | "video";
  metadata: {
    /** shown at the bottom of the map */
    attribution?: string;
    markdown?: string;
  };
  enableDownload: boolean;
  url?: string;
  tiles?: string;
  coordinates?: [
    [number, number],
    [number, number],
    [number, number],
    [number, number]
  ];
}
