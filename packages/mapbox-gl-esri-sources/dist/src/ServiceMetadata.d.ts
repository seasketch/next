import { SpatialReference, esriGeometryType } from "arcgis-rest-api";
export interface Extent {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    spatialReference: SpatialReference;
}
export interface SimpleLayerInfo {
    id: number;
    name: string;
    parentLayerId: number;
    defaultVisibility: boolean;
    subLayerIds: number[] | null;
    type: "Feature Layer" | "Raster Layer" | "Group Layer" | string;
    minScale: number;
    maxScale: number;
}
export interface MapServiceMetadata {
    /** ArcGIS Server REST API version */
    currentVersion: number;
    serviceDescription: string;
    /** Typically just "Layers". Better to use url slug as a name */
    mapName: string;
    description: string;
    copyrightText: string;
    supportsDynamicLayers: boolean;
    spatialReference: SpatialReference;
    singleFusedMapCache: boolean;
    tileInfo?: {
        rows: number;
        cols: number;
        dpi: number;
        format: string;
        compressionQuality: number;
        origin: {
            x: number;
            y: number;
        };
        spatialReference: SpatialReference;
        lods: {
            level: number;
            resolution: number;
            scale: number;
        }[];
    };
    initialExtent: Extent;
    fullExtent: Extent;
    supportedImageFormatTypes: string[];
    /**
     * comma separated list of supported capabilities - e.g. "Map,Query,Data"
     */
    capabilities: string;
    maxRecordCount: number;
    maxImageHeight: number;
    maxImageWidth: number;
    minScale: number;
    maxScale: number;
    minLOD?: number;
    maxLOD?: number;
    tileServers: string[];
    layers: SimpleLayerInfo[];
    documentInfo?: {
        Title?: string;
        Subject?: string;
        Author?: string;
        Comments?: string;
        Keywords?: string;
    };
}
export interface FeatureServerMetadata {
    /** ArcGIS Server REST API version */
    currentVersion: number;
    serviceDescription: string;
    maxRecordCount: number;
    supportedQueryFormats: string;
    supportedExportFormats: string;
    capabilities: string;
    description: string;
    copyrightText: string;
    spatialReference: SpatialReference;
    initialExtent: Extent;
    fullExtent: Extent;
    size?: number;
    layers: SimpleLayerInfo[];
    documentInfo: undefined;
}
export interface LayersMetadata {
    layers: DetailedLayerMetadata[];
}
export interface DetailedLayerMetadata {
    currentVersion: number;
    id: number;
    name: string;
    type: "Feature Layer" | "Raster Layer" | "Group Layer";
    description: string;
    geometryType: esriGeometryType;
    copyrightText: string;
    parentLayer: null | {
        id: number;
        name: string;
    };
    sublayers: {
        id: number;
        name: string;
    }[];
    minScale: number;
    maxScale: number;
    defaultVisibility: boolean;
    extent: {
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
        spatialReference: SpatialReference;
    };
    hasAttachments: boolean;
    htmlPopupType: "esriServerHTMLPopupTypeNone" | "esriServerHTMLPopupTypeAsURL" | "esriServerHTMLPopupTypeAsHTMLText";
    displayField: string;
    typeIdField: string;
    fields: {
        name: string;
        type: string;
        alias: string;
        domain: null | {
            type: "codedValue";
            name: string;
            codedValues: {
                name: string;
                code: string;
            }[];
        };
        length: number;
        editable?: boolean;
        nullable?: boolean;
    }[];
    maxRecordCount: number;
    supportedQueryFormats: string;
    advancedQueryCapabilities: {
        supportsPagination: boolean;
    };
}
export interface LayerLegendData {
    label: string;
    url: string;
    imageData: string;
    contentType: string;
    height: number;
    width: 20;
}
//# sourceMappingURL=ServiceMetadata.d.ts.map