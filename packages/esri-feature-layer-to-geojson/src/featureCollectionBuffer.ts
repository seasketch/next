import { Feature, Geometry } from "geojson";
import { PagedFeatures } from "./fetchFeatures";

/**
 * FeatureCollectionWriter writes paged features to a stream, buffering JSON
 * until the given thresholds are reached. This way for small datasets, it's
 * possible to return an entired FeatureCollection in a single response with a
 * known content length. For larger datasets, the response can be streamed, and
 * the content length will be unknown. For large datasets it would be impossible
 * to buffer the entire response in memory (Cloudflare Workers have a 128MB
 * memory limit).
 *
 */
export class FeatureCollectionBuffer {
  encoder = new TextEncoder();
  writer: WritableStreamDefaultWriter<Uint8Array>;
  contentLength = 0;
  features: Feature<Geometry>[] = [];
  memoryLimit: number;
  pagesFetched = 0;
  pageThreshold: number;
  private finished = false;
  stopBufferingJSON = false;

  /**
   * @param writer WritableStreamDefaultWriter to stream the GeoJSON feature
   * collection to.
   * @param memoryLimit Maximum number of bytes to buffer GeoJSON features before
   * streaming.
   * @param pageThreshold Maximum number of pages to buffer before streaming.
   */
  constructor(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    memoryLimit: number,
    pageThreshold: number
  ) {
    this.writer = writer;
    this.write(`{"type":"FeatureCollection","features":[`);
    this.memoryLimit = memoryLimit;
    this.pageThreshold = pageThreshold;
  }

  /**
   * Writes the given string to the stream using the proper encoder, while
   * keeping track of the content length.
   * @param data string to write to the stream
   */
  private write(data: string) {
    const encoded = this.encoder.encode(data);
    this.writer.write(encoded);
    this.contentLength += encoded.byteLength;
  }

  /**
   * Writes the given page of features to the stream, and buffers the features
   * in memory if the thresholds have not been reached.
   * @param page PagedFeatures
   */
  writePage(page: PagedFeatures) {
    this.pagesFetched++;
    if (this.finished) {
      throw new Error("Cannot write to finished FeatureCollectionWriter");
    }
    if (page.pagesFetched !== 1) {
      this.write(",");
    }
    this.write(JSON.stringify(page.features).slice(1, -1));
    if (!this.stopBufferingJSON) {
      this.features.push(...page.features);
    }
    if (!this.overStreamingThreshold()) {
      this.stopBufferingJSON = true;
    }
  }

  /**
   * Writes the final fragments of the GeoJSON feature collection to the stream.
   * Call before closing the stream.
   */
  finish() {
    this.write(`]}`);
  }

  /**
   * Returns the GeoJSON FeatureCollection buffered in memory as a string.
   */
  toJSON() {
    return JSON.stringify({
      type: "FeatureCollection",
      features: this.features,
    });
  }

  /**
   * Returns true if the content length or page threshold has been exceeded.
   */
  overStreamingThreshold() {
    return (
      this.contentLength >= this.memoryLimit ||
      this.pagesFetched >= this.pageThreshold
    );
  }
}
