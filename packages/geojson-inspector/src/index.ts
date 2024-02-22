/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { FailedInspectorResponse, InspectorResponse } from './types';
import calcBBox from '@turf/bbox';

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
		// fetch the geojson from the provided location
		const startT = performance.now();
		const response = await fetch(location, {
			headers: {
				accept: 'application/json',
			},
		});
		const endT = performance.now();
		let failedResponse: FailedInspectorResponse;
		// if the fetch fails return an error
		if (!response.ok) {
			if (response.status === 404) {
				failedResponse = {
					location,
					error: 'Server returned 404. Location not found',
					errorsStatus: 404,
				};
			} else if (response.status >= 400 && response.status < 500) {
				failedResponse = {
					location,
					error: 'Client error. Please check the location',
					errorsStatus: response.status,
				};
			} else {
				const text = await response.text();
				failedResponse = {
					location,
					error: 'Server error. Could not retrieve data from location.\n' + text,
					errorsStatus: response.status,
				};
			}
			return new Response(JSON.stringify(failedResponse), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=10, s-maxage=10',
				},
			});
		} else {
			let contentLength = parseInt(response.headers.get('content-length') || '0');
			if (contentLength === 0) {
				const blob = await response.clone().blob();
				contentLength = blob.size;
			}
			const contentType = response.headers.get('content-type');
			const cacheControl = response.headers.get('cache-control');
			try {
				const geojson: any = await response.json();
				if (!('type' in geojson)) {
					failedResponse = {
						location,
						error: 'Response is not a valid GeoJSON',
						errorsStatus: 200,
					};
					return new Response(JSON.stringify(failedResponse), {
						status: 200,
						headers: {
							'Content-Type': 'application/json',
							'Cache-Control': 'public, max-age=10, s-maxage=10',
						},
					});
				} else if (geojson.type !== 'FeatureCollection' && geojson.type !== 'Feature') {
					failedResponse = {
						location,
						error: 'GeoJSON object must be a Feature or FeatureCollection',
						errorsStatus: 200,
					};
					return new Response(JSON.stringify(failedResponse), {
						status: 200,
						headers: {
							'Content-Type': 'application/json',
							'Cache-Control': 'public, max-age=10, s-maxage=10',
						},
					});
				} else {
					const rootType = geojson.type;
					return new Response(
						JSON.stringify({
							location,
							contentLength,
							contentType: contentType || '',
							cacheControl: cacheControl || '',
							latency: endT - startT,
							rootType,
							featureCount: rootType === 'FeatureCollection' ? geojson.features.length : 1,
							geometryType: rootType === 'FeatureCollection' ? geojson.features[0]?.geometry?.type || 'Unknown' : geojson.geometry.type,
							bbox: calcBBox(geojson),
						} as InspectorResponse),
						{
							status: 200,
							headers: {
								'Content-Type': 'application/json',
								'Cache-Control': 'public, max-age=120, s-maxage=120',
							},
						}
					);
				}
			} catch (e) {
				failedResponse = {
					location,
					error: 'Failed to parse response as JSON',
					errorsStatus: 200,
				};
				return new Response(JSON.stringify(failedResponse), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'public, max-age=10, s-maxage=10',
					},
				});
			}
		}
	},
};
