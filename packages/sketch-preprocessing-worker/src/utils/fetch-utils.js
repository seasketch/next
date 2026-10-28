import { resolveStorageUrl } from "overlay-engine";
// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map();
function getRequestKey(key, range) {
    return `${key}:${range[0]}-${range[1] ?? ""}`;
}
async function fetchRangeFromBucket(key, bucket, range, ctx, skipCache = false) {
    const target = resolveStorageUrl(key);
    const objectKey = decodeURIComponent(target.pathname.replace(/^\//, ""));
    const cacheKey = `${target.href}?bytes=${range[0]}-${range[1] ? range[1] : ""}`;
    const request = new Request(cacheKey);
    if (!skipCache) {
        const cached = await caches.default.match(request);
        if (cached) {
            return await cached.arrayBuffer();
        }
    }
    let body;
    if (ctx.env.DEV) {
        console.warn("dev mode,fetching via https");
        const res = await fetch(target.href, {
            headers: {
                Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
            },
        });
        body = res;
    }
    else {
        body = await bucket.get(objectKey, {
            range: new Headers({
                Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
            }),
        });
        if (!body && /^[a-z][a-z0-9+.-]*:\/\//i.test(key)) {
            const res = await fetch(target.href, {
                headers: {
                    Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}`,
                },
            });
            body = res;
        }
    }
    if (!body) {
        throw new Error("Range request to R2 bucket did not return a body");
    }
    const buffer = await body.arrayBuffer();
    const response = new Response(buffer, {
        status: 200,
        headers: new Headers({
            "Content-Type": "application/octet-stream",
            "Access-Control-Allow-Origin": "*",
            "Content-Range": `bytes ${range[0]}-${range[1] ? range[1] : ""}/*`,
        }),
    });
    if (!skipCache) {
        ctx.executionCtx.waitUntil(caches.default.put(request, response.clone()));
    }
    return buffer;
}
export function makeFetchRangeFn(ctx) {
    return async (key, range) => {
        const requestKey = getRequestKey(key, range);
        const existingRequest = inFlightRequests.get(requestKey);
        if (existingRequest) {
            return existingRequest;
        }
        console.log(`fetching ${range[1] ? range[1] - range[0] : "unknown"} bytes`);
        const request = fetchRangeFromBucket(key, ctx.env.SSN_TILES, range, ctx)
            .then((buffer) => {
            inFlightRequests.delete(requestKey);
            return buffer;
        })
            .catch((error) => {
            inFlightRequests.delete(requestKey);
            throw error;
        });
        inFlightRequests.set(requestKey, request);
        return request;
    };
}
