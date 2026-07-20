import { ByteBuffer } from "flatbuffers";
import { Feature as FgbFeature } from "flatgeobuf";
import { fromFeature } from "flatgeobuf/lib/mjs/geojson/feature";
import { parseProperties } from "flatgeobuf/lib/mjs/generic/feature";
import { fromByteBuffer } from "flatgeobuf/lib/mjs/header-meta";
import type { Feature, Geometry } from "geojson";
import { fetchPropertiesRange } from "./fetch";

// FlatGeobuf magic: "fgb" + version + "fgb" + flags. Production files often
// have a non-zero final flags byte; only the first 7 bytes are required.
const MAGIC = [0x66, 0x67, 0x62, 3, 0x66, 0x67, 0x62, 0];
const MAGIC_PREFIX_LEN = MAGIC.length - 1;
const INITIAL_HEADER_BYTES = 32 * 1024;
const NODE_BYTES = 40;

export type PropertyRecord = Record<string, unknown> & {
  __offset: number;
  __byteLength: number;
};

export async function readFgbRecords(
  bucket: R2Bucket,
  key: string,
  includeGeometry: boolean,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Array<{ properties: PropertyRecord; feature?: Feature<Geometry> }>> {
  const fetchRange = (range: [number, number | null]) =>
    fetchPropertiesRange(bucket, key, range, waitUntil);
  let headerData = await fetchRange([0, INITIAL_HEADER_BYTES]);
  const view = new DataView(headerData);
  for (let index = 0; index < MAGIC_PREFIX_LEN; index++) {
    if (view.getUint8(index) !== MAGIC[index]) {
      throw new Error("invalid_flatgeobuf");
    }
  }
  const headerSize = view.getUint32(MAGIC.length, true);
  const headerOffset = MAGIC.length + 4;
  const header = fromByteBuffer(
    new ByteBuffer(new Uint8Array(headerData, MAGIC.length)),
  );
  const indexSize = header.indexNodeSize
    ? packedRTreeBytes(header.featuresCount, header.indexNodeSize)
    : 0;
  const featureDataOffset = headerOffset + headerSize + indexSize;
  if (headerData.byteLength < featureDataOffset) {
    headerData = await fetchRange([0, featureDataOffset - 1]);
  }

  const bytes = await fetchRange([featureDataOffset, null]);
  const records: Array<{
    properties: PropertyRecord;
    feature?: Feature<Geometry>;
  }> = [];
  const data = new DataView(bytes);
  let offset = 0;
  while (offset + 4 <= bytes.byteLength) {
    const size = data.getUint32(offset, true);
    const byteLength = size + 4;
    if (size === 0) break;
    if (offset + byteLength > bytes.byteLength) {
      throw new Error("invalid_flatgeobuf_feature");
    }
    // View into the feature section — no per-feature copy.
    const aligned = new Uint8Array(bytes, offset, byteLength);
    const buffer = new ByteBuffer(aligned);
    const feature = FgbFeature.getSizePrefixedRootAsFeature(buffer);
    const properties = {
      ...parseProperties(feature, header.columns),
      __byteLength: byteLength,
      __offset: offset,
    } as PropertyRecord;
    records.push({
      properties,
      feature: includeGeometry
        ? (fromFeature(offset, feature, header) as Feature<Geometry>)
        : undefined,
    });
    offset += byteLength;
  }
  return records;
}

function packedRTreeBytes(featureCount: number, nodeSizeInput: number): number {
  if (featureCount === 0) return 0;
  const nodeSize = Math.min(Math.max(nodeSizeInput, 2), 65535);
  let count = featureCount;
  let nodes = 0;
  do {
    nodes += count;
    count = Math.ceil(count / nodeSize);
  } while (count > 1);
  return (nodes + 1) * NODE_BYTES;
}
