import {
  Feature as GeoJSONFeature,
  GeoJsonProperties,
  Geometry,
} from "geojson";
import { HeaderMeta } from "flatgeobuf";
import { ByteBuffer } from "flatbuffers";
import { Feature } from "flatgeobuf/lib/mjs/flat-geobuf/feature";
import { fromFeature } from "flatgeobuf/lib/mjs/geojson/feature";
import { parseProperties as flatgeobufParseProperties } from "flatgeobuf/lib/mjs/generic/feature";
import { SIZE_PREFIX_LEN } from "./constants";

// Set to true to validate the feature data size prefix against the actual size
// fetched from the file. This is useful for debugging, but should be disabled
// in production.
export const VALIDATE_FEATURE_DATA = false;

/**
 * Feature with additional metadata from the FlatGeobuf file.
 */
export type FeatureWithMetadata<T = GeoJSONFeature> = T & {
  properties: GeoJsonProperties & {
    /** Length of the feature data in bytes */
    __byteLength: number;
    /** Offset of the feature in the FlatGeobuf file */
    __offset: number;
  };
};

/**
 * Validate that the feature data has the correct size prefix.
 */
export function validateFeatureData(view: DataView, size: number) {
  const sizePrefix = view.getUint32(0, true);
  // Only validate if explicitly enabled
  if (VALIDATE_FEATURE_DATA && sizePrefix !== size - SIZE_PREFIX_LEN) {
    throw new Error(
      `Feature data size mismatch: expected ${size}, size prefix was ${sizePrefix}`
    );
  }
}

/**
 * Parse feature data from a byte array and return a GeoJSON Feature.
 *
 * @param offset - Offset of the feature in the file, used as the feature ID
 * @param bytesAligned - Uint8Array of the feature data, with the size prefix
 * @param header - FlatGeobuf header metadata
 * @param bbox - Bounding box of the feature
 * @returns GeoJSON Feature with metadata
 */
export function parseFeatureData(
  offset: number,
  bytesAligned: Uint8Array,
  header: HeaderMeta,
  bbox?: [number, number, number, number]
): FeatureWithMetadata<any> {
  const bb = new ByteBuffer(bytesAligned);
  bb.setPosition(SIZE_PREFIX_LEN);
  const feature = fromFeature(offset, Feature.getRootAsFeature(bb), header);
  return {
    ...feature,
    bbox: bbox,
    properties: {
      ...feature.properties,
      __byteLength: bytesAligned.byteLength,
      __offset: offset,
    },
  };
}

/**
 * Parse properties from a FlatGeobuf feature.
 *
 * @param bb - ByteBuffer containing the feature data
 * @param columns - Column metadata from the FlatGeobuf header
 * @param offset - Offset of the feature in the file
 * @returns Parsed properties with metadata
 */
export function parseProperties(
  bb: ByteBuffer,
  columns: HeaderMeta["columns"],
  offset: number
): GeoJsonProperties & {
  __byteLength: number;
  __offset: number;
} {
  const feature = Feature.getRootAsFeature(bb);
  const props = flatgeobufParseProperties(feature, columns);
  return {
    ...props,
    __byteLength: bb.capacity(),
    __offset: offset,
  };
}
