import { useApolloClient } from "@apollo/client";
import { useEffect, useRef } from "react";
import type { ProjectMetadataFragment } from "../generated/graphql";
import {
  BaseReportContextDocument,
  ReportOverlaySourcesDocument,
} from "../generated/graphql";

type SketchClassList = ProjectMetadataFragment["sketchClasses"];

function scheduleIdle(callback: () => void): () => void {
  if (typeof requestIdleCallback !== "undefined") {
    const id = requestIdleCallback(() => callback(), { timeout: 15_000 });
    return () => cancelIdleCallback(id);
  }
  const t = window.setTimeout(callback, 2_000);
  return () => clearTimeout(t);
}

/**
 * After the map app has loaded project metadata, warms the Apollo cache with
 * BaseReportContext (keyed by report id) and ReportOverlaySources for each
 * published (non-archived) sketch class target. Scheduled only when the browser
 * is idle so map and critical queries stay prioritized.
 */
export default function ReportPublishedDataPrefetch({
  sketchClasses,
}: {
  sketchClasses: SketchClassList | undefined;
}) {
  const client = useApolloClient();
  const lastFingerprintRef = useRef<string>("");

  useEffect(() => {
    const targets =
      Array.from(
        new Set(
          sketchClasses?.filter(
            (sc) => !sc.isArchived && sc.report?.id != null
          ) ?? []
        )
      ) ?? [];
    const fingerprint = targets
      .map((t) => `${t.id}:${t.report?.id}`)
      .sort()
      .join("|");
    if (!fingerprint || fingerprint === lastFingerprintRef.current) {
      return;
    }
    lastFingerprintRef.current = fingerprint;

    let cancelled = false;
    const cancelIdle = scheduleIdle(() => {
      void (async () => {
        for (const sc of targets) {
          if (cancelled) {
            return;
          }
          try {
            await client.query({
              query: BaseReportContextDocument,
              variables: { reportId: sc.report!.id },
              fetchPolicy: "cache-first",
            });
            if (cancelled) {
              return;
            }
            await client.query({
              query: ReportOverlaySourcesDocument,
              variables: { reportId: sc.report!.id },
              fetchPolicy: "cache-first",
            });
          } catch {
            // Best-effort cache warm; ignore auth/network failures for classes the user cannot access.
          }
          await new Promise((r) => setTimeout(r, 32));
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [client, sketchClasses]);

  return null;
}
