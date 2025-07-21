import { AnySourceData, Map } from "mapbox-gl";
import { DetailedLayerMetadata, Extent, FeatureServerMetadata, MapServiceMetadata } from "./ServiceMetadata";
import { SpatialReference } from "arcgis-rest-api";
import { MapServiceLegendMetadata } from "./ArcGISRESTServiceRequestManager";
/**
 * Replaced an existing source, preserving layers and their order by temporarily
 * removing them
 * @param sourceId ID of the source to replace
 * @param map Mapbox GL JS Map instance
 * @param sourceData Replacement source options
 */
export declare function replaceSource(sourceId: string, map: Map, sourceData: AnySourceData): void;
/**
 * Convert meters to degrees in web mercator projection
 * @param x
 * @param y
 * @returns [lon, lat]
 */
export declare function metersToDegrees(x: number, y: number): [number, number];
/**
 * Convert an ArcGIS REST Service extent to a Mapbox GL JS LatLngBounds
 * compatible array
 * @param extent
 * @returns [xmin, ymin, xmax, ymax]
 */
export declare function extentToLatLngBounds(extent: Extent): Promise<[number, number, number, number] | void>;
export declare function normalizeSpatialReference(sr: SpatialReference): number;
export declare function projectExtent(extent: Extent): Promise<any>;
export declare function contentOrFalse(str?: string): string | false;
/**
 * Uses service metadata to create a markdown-like prosemirror document which
 * represents layer metadata
 * @param url
 * @param mapServerInfo
 * @param layer
 * @returns
 */
export declare function generateMetadataForLayer(url: string, mapServerInfo: MapServiceMetadata | FeatureServerMetadata, layer: DetailedLayerMetadata): {
    type: string;
    content: ({
        type: string;
        attrs: {
            level: number;
        };
        content: {
            type: string;
            text: string;
        }[];
        marks?: undefined;
    } | {
        type: string;
        content: {
            type: string;
            text: string;
        }[];
        attrs?: undefined;
        marks?: undefined;
    } | {
        type: string;
        attrs?: undefined;
        content?: undefined;
        marks?: undefined;
    } | {
        type: string;
        marks: never[];
        attrs: {
            level?: undefined;
        };
        content: {
            type: string;
            content: {
                type: string;
                content: {
                    type: string;
                    text: string;
                }[];
            }[];
        }[];
    } | {
        type: string;
        content: {
            type: string;
            marks: {
                type: string;
                attrs: {
                    href: string;
                    title: string;
                };
            }[];
            text: string;
        }[];
        attrs?: undefined;
        marks?: undefined;
    })[];
};
export declare function makeLegend(data: MapServiceLegendMetadata, layerId: number): {
    id: string;
    label: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
}[] | undefined;
//# sourceMappingURL=utils.d.ts.map