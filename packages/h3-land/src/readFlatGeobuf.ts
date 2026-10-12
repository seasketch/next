import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { geojson } from "flatgeobuf";
import type { Feature, Geometry } from "geojson";

type HeaderMeta = {
  featuresCount: number | bigint;
};

/**
 * Stream features from a local FlatGeobuf file. The packed index is skipped;
 * this is a full sequential read, which is what a global classification needs.
 */
export async function* readFlatGeobuf(
  path: string,
  onHeader?: (header: { featuresCount: number }) => void
): AsyncGenerator<Feature<Geometry | null>> {
  const web = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
  const features = geojson.deserialize(
    web,
    undefined,
    (header: HeaderMeta) => {
      onHeader?.({ featuresCount: Number(header.featuresCount) });
    }
  );
  for await (const feature of features) {
    yield feature as Feature<Geometry | null>;
  }
}
