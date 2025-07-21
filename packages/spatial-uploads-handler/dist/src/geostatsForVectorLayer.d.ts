import { GeostatsAttribute, GeostatsLayer } from "@seasketch/geostats-types";
/**
 * Given a path to a vector file, return an array of GeostatsLayer objects
 * describing the layers in the file. Each GeostatsLayer object contains
 * information about the layer, its geometry type, and the attributes of the
 * layer useful for data handling and cartography.
 * @param filepath
 * @returns
 */
export declare function geostatsForVectorLayers(filepath: string): Promise<GeostatsLayer[]>;
export { GeostatsAttribute };
//# sourceMappingURL=geostatsForVectorLayer.d.ts.map