import { MetricSubjectFragment, MetricSubjectGeography } from "overlay-engine";
import { FragmentSubjectPayload, GeographySubjectPayload, OverlayWorkerPayload } from "./types";
export default function handler(payload: OverlayWorkerPayload): Promise<void>;
export declare function validatePayload(data: any): OverlayWorkerPayload;
/**
 * Type guard for fragment subjects in worker payloads.
 *
 * The API sends `{ hash, geobuf }` (see calculateSpatialMetricsBatch). The
 * historical FragmentSubjectPayload type documents `fragmentHash`; accept
 * either so callers that key on this guard (e.g. buffered overlay_area collar
 * collection) actually run for real fragment jobs.
 */
export declare function subjectIsFragment(subject: any): subject is MetricSubjectFragment & FragmentSubjectPayload;
export declare function subjectIsGeography(subject: any): subject is MetricSubjectGeography & GeographySubjectPayload;
//# sourceMappingURL=overlay-worker.d.ts.map