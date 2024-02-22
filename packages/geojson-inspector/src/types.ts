import { GeostatsLayer } from '../../spatial-uploads-handler/src/geostats';
interface BaseInspectorResponse {
	location: string;
}

export interface FailedInspectorResponse extends BaseInspectorResponse {
	error: string;
	errorsStatus: number;
}

export interface SuccessfulInspectorResponse extends BaseInspectorResponse {
	contentLength: number;
	contentType?: string;
	cacheControl?: string;
	latency: number;
	bbox: number[];
	geostats: GeostatsLayer;
}

export type InspectorResponse = FailedInspectorResponse | SuccessfulInspectorResponse;

export function isSuccessfulInspectorResponse(response: InspectorResponse): response is SuccessfulInspectorResponse {
	return (response as FailedInspectorResponse).error === undefined;
}
