import { MetricSubjectFragment, MetricSubjectGeography } from "overlay-engine";
import { FragmentSubjectPayload, GeographySubjectPayload, OverlayWorkerPayload } from "./types";
export default function handler(payload: OverlayWorkerPayload & {
    includedProperties?: string[];
    resultsLimit?: number;
    valueColumn?: string;
}): Promise<void>;
export declare function validatePayload(data: any): OverlayWorkerPayload;
export declare function subjectIsFragment(subject: any): subject is MetricSubjectFragment & FragmentSubjectPayload;
export declare function subjectIsGeography(subject: any): subject is MetricSubjectGeography & GeographySubjectPayload;
//# sourceMappingURL=overlay-worker.d.ts.map