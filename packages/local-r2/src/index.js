// The S3 API is served by Miniflare in front of this Worker, not by it.
// This fetch handler exists because wrangler needs an entry point and because
// the contract test reads objects back through the R2 binding, which is how
// pmtiles-server and the sketch-preprocessing Worker read in production.
//
//   GET /health                       200, the readiness probe for npm run dev
//   GET /binding/<bucket_name>/<key>  the object, read through the binding

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok");
    }
    const match = /^\/binding\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (request.method !== "GET" || !match) {
      return new Response("local-r2: use the S3 API at /cdn-cgi/local/r2/s3/", {
        status: 404,
      });
    }
    const [, bucketName, key] = match;
    const binding = bucketByName(env, bucketName);
    if (!binding) {
      return new Response(`no local bucket named ${bucketName}`, { status: 404 });
    }
    const object = await binding.get(decodeURIComponent(key), {
      range: request.headers,
    });
    if (!object) {
      return new Response("not found", { status: 404 });
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  },
};

// Bindings are keyed by binding name in env. The contract test addresses
// buckets by bucket_name, so the names are mapped here. Keep in sync with
// wrangler.jsonc.
function bucketByName(env, bucketName) {
  const byName = {
    "ssn-tiles-local": env.TILES_BUCKET,
    "ssn-spatial-uploads-tmp-local": env.SPATIAL_UPLOADS_BUCKET,
  };
  return byName[bucketName];
}
