import {
  DELIMITED_SAMPLE_BYTES,
  detectDelimitedGeometry,
  processingOptionsFromDetectionResult,
} from "./detectDelimitedGeometry";
import {
  DelimitedUploadProcessingOptions,
  DetectDelimitedGeometryResult,
} from "./types";

/** Bytes read from each file for client-side column detection. */
export { DELIMITED_SAMPLE_BYTES } from "./detectDelimitedGeometry";

export async function readDelimitedFileSample(file: File): Promise<string> {
  return file.slice(0, DELIMITED_SAMPLE_BYTES).text();
}

export async function detectDelimitedGeometryFromFile(
  file: File
): Promise<DetectDelimitedGeometryResult> {
  const sample = await readDelimitedFileSample(file);
  return detectDelimitedGeometry(sample);
}

/** True when detection is confident enough to upload without the config modal. */
export function isAutoUploadReady(result: DetectDelimitedGeometryResult): boolean {
  return (
    !result.error &&
    result.confidence === "high" &&
    Boolean(processingOptionsFromDetectionResult(result))
  );
}

export function getDelimitedUploadBlockingError(
  result: DetectDelimitedGeometryResult,
  fileName?: string
): string | null {
  if (!result.error) return null;
  return fileName ? `${fileName}: ${result.error}` : result.error;
}

export type ResolvedDelimitedUpload = {
  file: File;
  detection: DetectDelimitedGeometryResult;
  processingOptions: DelimitedUploadProcessingOptions | null;
  needsConfig: boolean;
  blockingError: string | null;
};

export async function resolveDelimitedUploads(
  files: File[]
): Promise<ResolvedDelimitedUpload[]> {
  return Promise.all(
    files.map(async (file) => {
      const detection = await detectDelimitedGeometryFromFile(file);
      const processingOptions = processingOptionsFromDetectionResult(detection);
      const blockingError = getDelimitedUploadBlockingError(
        detection,
        file.name
      );
      return {
        file,
        detection,
        processingOptions,
        needsConfig: !isAutoUploadReady(detection),
        blockingError,
      };
    })
  );
}
