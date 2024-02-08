import { Feature, Geometry } from "geojson";
import { PagedFeatures, fetchFeatures, getLayerName } from "./fetchFeatures";

const STREAMING_RESPONSE_BYTES_THRESHOLD = 1024 * 1024 * 5; // 5MB
const STREAMING_RESPONSE_PAGES_THRESHOLD = 3;

export default {
	async fetch(request: Request, env: {}, ctx: ExecutionContext) {
		if (request.method !== "GET") {
			return new Response("Only GET requests are supported", {
				status: 405,
			});
		}
		const location = new URL(request.url).searchParams.get("location");
		if (!location) {
			return new Response("Missing location parameter", {
				status: 400,
			});
		}
		// fetches layer name from service metadata
		const layerName = await getLayerName(location);
		const headers = {
			"content-type": "application/json",
			"cache-control": "public, max-age=3600, s-maxage=3600",
			"content-disposition": `attachment; filename=${layerName}.geojson`
		};
		const { readable, writable } = new TransformStream();
		const writer = writable.getWriter();
		const collection = new FeatureCollectionWriter(writer, 
			STREAMING_RESPONSE_BYTES_THRESHOLD, STREAMING_RESPONSE_PAGES_THRESHOLD);
		const deferred = new Deferred<Response>();
		
		ctx.waitUntil((async () => {
			for await (const page of fetchFeatures(location, {})) {
				if (!deferred.isResolved && collection.overStreamingThreshold()) {
					deferred.resolve!(new Response(readable, {
						headers,
					}));
				}
				collection.writePage(page);
			}
			if (!deferred.isResolved) {
				return deferred.resolve!(new Response(collection.toJSON(), {
					headers: {
						...headers,
						"content-length": collection.contentLength.toString(),
						"x-seasketch-pages": collection.pagesFetched.toString(),
					}
				}));
			} else {
				collection.finish();
				return writer.close();
			}
		})());
		
		const response = await deferred.promise;
		return response;
	},
};

class Deferred<T> {
	promise: Promise<T>;
	resolve?: (value: T) => void;
	reject?: (reason?: any) => void;
	isResolved = false;
  constructor() {
    this.promise = new Promise((resolve, reject)=> {
      this.reject = reject
      this.resolve = (value: T) => {
				this.isResolved = true;
				resolve(value);
			}
    })
  }
}

class FeatureCollectionWriter {
	encoder = new TextEncoder();
	writer: WritableStreamDefaultWriter<Uint8Array>;
	contentLength = 0;
	features: Feature<Geometry>[] = [];
	memoryLimit: number;
	pagesFetched = 0;
	pageThreshold: number;
	private finished = false;
	
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

	private write(data: string) {
		const encoded = this.encoder.encode(data);
		this.writer.write(encoded);
		this.contentLength += encoded.byteLength;
	}

	writePage(page: PagedFeatures) {
		this.pagesFetched++;
		if (this.finished) {
			throw new Error("Cannot write to finished FeatureCollectionWriter");
		}
		if (page.pagesFetched !== 1) {
			this.write(",");
		}
		this.write(JSON.stringify(page.features).slice(1, -1));
		if (!this.overStreamingThreshold()) {
			this.features.push(...page.features);
		}
	}

	finish() {
		this.write(`]}`);
	}

	toJSON() {
		return JSON.stringify({
			type: "FeatureCollection", 
			features: this.features
		});
	}

	overStreamingThreshold() {
		return this.contentLength >= this.memoryLimit || 
			this.pagesFetched >= this.pageThreshold;
	}
}