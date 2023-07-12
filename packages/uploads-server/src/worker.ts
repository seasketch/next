/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	// MY_KV_NAMESPACE: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	SSN_UPLOADS: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

function objectNotFound(objectName: string): Response {
	return new Response(`<html><body>R2 object "<b>${objectName}</b>" not found</body></html>`, {
		status: 404,
		headers: {
			'content-type': 'text/html; charset=UTF-8',
		},
	});
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const objectName = url.pathname.slice(1);
		// Construct the cache key from the cache URL
		const cacheKey = new Request(url.toString(), request);
		const cache = caches.default;

		console.log(`${request.method} object ${objectName}: ${request.url}`);

		if (request.method === 'GET' || request.method === 'HEAD') {
			if (objectName === '' || objectName.endsWith('/')) {
				if (request.method == 'HEAD') {
					return new Response(undefined, { status: 400 });
				}

				return new Response(`<html><body>Listing uploads is <b>not</b> supported.</body></html>`, {
					headers: {
						'content-type': 'text/html; charset=UTF-8',
					},
				});
			}

			if (request.method === 'GET') {
				// Check whether the value is already available in the cache
				// if not, you will need to fetch it from R2, and store it in the cache
				// for future access
				let cachedResponse = await cache.match(cacheKey);
				if (cachedResponse) {
					console.log(`Cache hit for: ${request.url}.`);
					return cachedResponse;
				}

				console.log(`Response for request url: ${request.url} not present in cache. Fetching and caching request.`);

				const object = await env.SSN_UPLOADS.get(objectName, {
					range: request.headers,
				});

				if (object === null) {
					return objectNotFound(objectName);
				}

				const headers = new Headers();
				object.writeHttpMetadata(headers);
				headers.set('Cache-Control', 'public, max-age=31536000, immutable');
				// TODO: limit in the future to prevent hot-linking
				headers.set('Access-Control-Allow-Origin', '*');
				headers.set('etag', object.httpEtag);
				if (object.range) {
					// @ts-ignore
					headers.set('content-range', `bytes ${object.range.offset}-${object.range.end}/${object.size}`);
				}
				const status = object.body ? (request.headers.get('range') !== null ? 206 : 200) : 304;
				const response = new Response(object.body, {
					headers,
					status,
				});

				ctx.waitUntil(cache.put(cacheKey, response.clone()));

				return response;
			}

			const object = await env.SSN_UPLOADS.head(objectName);

			if (object === null) {
				return objectNotFound(objectName);
			}

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set('etag', object.httpEtag);
			return new Response(null, {
				headers,
			});
		}

		return new Response(`Unsupported method`, {
			status: 400,
		});
	},
};
