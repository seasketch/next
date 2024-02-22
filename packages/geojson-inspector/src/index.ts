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
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// validate that request is a GET request and includes a search param named
		// location
		if (request.method !== 'GET') {
			return new Response('Method not allowed', { status: 405 });
		}
		// create a URL, access searchparams, and get the location
		const url = new URL(request.url);
		const location = url.searchParams.get('location');
		// if location is not provided return an error
		if (!location) {
			return new Response('Please provide a location', { status: 400 });
		}
		// https://uploads.seasketch.org/projects/cburt/public/4b08062c-9218-45d7-a00c-5147e103e02b.geojson.json
		return new Response('Hello World!');
	},
};
