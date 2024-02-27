import { fetchFeatures, getLayerName } from "./fetchFeatures";
import { FeatureCollectionBuffer } from "./featureCollectionBuffer";
import { Deferred } from "./Deferred";
import {
  PutObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

interface Env {
  STREAMING_RESPONSE_BYTES_THRESHOLD: number;
  STREAMING_RESPONSE_PAGES_THRESHOLD: number;
  SEASKETCH_UPLOADS_ACCESS_KEY_ID: string;
  SEASKETCH_UPLOADS_SECRET_ACCESS_KEY: string;
  SEASKETCH_UPLOADS_BUCKET: string;
  SEASKETCH_UPLOADS_REGION: string;
}

let client: S3Client;
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // return with cache if possible
    const cachedResponse = await caches.default.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (!client) {
      client = new S3Client({
        region: env.SEASKETCH_UPLOADS_REGION,
        credentials: {
          accessKeyId: env.SEASKETCH_UPLOADS_ACCESS_KEY_ID,
          secretAccessKey: env.SEASKETCH_UPLOADS_SECRET_ACCESS_KEY,
        },
      });
    }
    if (request.method !== "GET") {
      return new Response("Only GET requests are supported", {
        status: 405,
      });
    }
    const params = new URL(request.url).searchParams;
    const location = params.get("location");
    if (!location) {
      return new Response("Missing location parameter", {
        status: 400,
      });
    }
    const store = params.get("store") === "true";
    // Exclude requests from unauthorized origins
    const referer = request.headers.get("referer");
    if (referer) {
      const ref = new URL(referer);
      if (
        !ref.host.includes("seasketch.org") &&
        !ref.host.includes("localhost")
      ) {
        return new Response("Not authorized", {
          status: 403,
        });
      }
    }
    // fetch the layer name from service metadata and use it as the filename.
    let layerName = params.get("download");
    if (!layerName) {
      try {
        layerName = await getLayerName(location);
      } catch (e: any) {
        return new Response(e.toString(), {
          status: 500,
        });
      }
    }

    const headers = {
      "content-type": "application/json",
      // Cache for 3 hours
      "cache-control": "public, max-age=10800",
      "content-disposition": `attachment; filename=${layerName}.geojson`,
    };

    // Setup streams and buffers for handling paged feature data
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    // The collection will buffer features in memory until the thresholds are
    // met, while also streaming data to the TransformStream.
    const collection = new FeatureCollectionBuffer(
      writer,
      env.STREAMING_RESPONSE_BYTES_THRESHOLD,
      env.STREAMING_RESPONSE_PAGES_THRESHOLD
    );

    let upload: Promise<Response> | undefined;
    if (store) {
      const Key = `${crypto.randomUUID()}/${layerName}.geojson.json`;
      const command = new PutObjectCommand({
        Bucket: env.SEASKETCH_UPLOADS_BUCKET,
        Key,
        Body: readable,
      });
      upload = new Upload({
        client,
        params: {
          Bucket: env.SEASKETCH_UPLOADS_BUCKET,
          Key,
          Body: readable,
        },
      })
        .done()
        .then((result) => {
          return new Response(
            JSON.stringify({
              key: Key,
            }),
            {
              headers: {
                "content-type": "application/json",
                "cache-control": "public, max-age=10800",
              },
            }
          );
        });
    }

    // Represent the response as a deffered promise so that the function can
    // return the response only after it is determined whether to return a
    // streaming response or to buffer the entire feature collection in memory
    // first.
    const deferred = new Deferred<Response>();

    // Tells the cloudflare worker environment to keep executing the worker
    // until paging of features is complete. This is necessary because we
    // may return a Response with a streaming body.
    ctx.waitUntil(
      (async () => {
        for await (const page of fetchFeatures(location)) {
          // If thresholds are met, immediately return a streaming response
          if (
            !deferred.isResolved &&
            collection.overStreamingThreshold() &&
            !upload
          ) {
            deferred.resolve!(
              new Response(readable, {
                headers,
              })
            );
          }
          collection.writePage(page);
        }
        // After paging through all features, if a streaming response has not
        // been returned yet, resolve a response with the entire feature
        // collection buffered in memory.
        if (!deferred.isResolved && !upload) {
          return deferred.resolve!(
            new Response(collection.toJSON(), {
              headers: {
                ...headers,
                "content-length": collection.contentLength.toString(),
                "x-seasketch-pages": collection.pagesFetched.toString(),
              },
            })
          );
        } else {
          // If a streaming response has been returned, finish writing the
          // feature collection to the stream and close the writer.
          collection.finish();
          return writer.close();
        }
      })()
    );

    if (upload) {
      const response = await upload;
      caches.default.put(request, response.clone());
      return response;
    } else {
      // Only return a response after the deferred promise has been resolved.
      // This may be a streaming response, in which case the waitUntil call
      // will keep the worker open until the streaming response is complete.
      // Or, it may be a buffered response, in which case the worker will
      // close after the response is returned.
      const response = await deferred.promise;
      caches.default.put(request, response.clone());
      return response;
    }
  },
};
