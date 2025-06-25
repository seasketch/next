import { join } from "path";
import Piscina from "piscina";
import {
  ClippingOperation,
  Cql2Query,
  PolygonClipResult,
  PreparedSketch,
} from "overlay-engine";
import { Feature, MultiPolygon, Polygon } from "geojson";
import { ClippingWorkerData } from "./types";

class ClippingWorkerManager {
  private pool: Piscina;

  constructor() {
    this.pool = new Piscina({
      filename: join(__dirname, "clippingWorker.js"),
      maxQueue: 12, // Allow up to 12 simultaneous waiting clipping operations before rejecting new ones
    });
  }

  async clipSketchToPolygonsWithWorker(
    preparedSketch: PreparedSketch,
    op: ClippingOperation,
    cql2Query: Cql2Query | undefined,
    polygonSource: AsyncIterable<Feature<MultiPolygon | Polygon>>
  ): Promise<PolygonClipResult> {
    // Collect all polygons from the async iterable
    const polygons: Feature<MultiPolygon | Polygon>[] = [];
    for await (const polygon of polygonSource) {
      polygons.push(polygon);
    }

    // If no polygons, handle the edge cases directly
    if (polygons.length === 0 && op === "INTERSECT") {
      return { changed: true, output: null, op };
    } else if (polygons.length === 0 && op === "DIFFERENCE") {
      return { changed: false, output: preparedSketch.feature, op };
    }

    const data: ClippingWorkerData = {
      preparedSketch,
      op,
      cql2Query,
      polygons,
    };

    try {
      const result = await this.pool.run(data, {
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });

      return result as PolygonClipResult;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Clipping operation timed out");
      }
      throw error;
    }
  }

  async terminate(): Promise<void> {
    await this.pool.destroy();
  }
}

// Export a singleton instance
export const clippingWorkerManager = new ClippingWorkerManager();

// Cleanup on process exit
process.on("exit", () => {
  clippingWorkerManager.terminate();
});

process.on("SIGINT", () => {
  clippingWorkerManager.terminate();
  process.exit(0);
});

process.on("SIGTERM", () => {
  clippingWorkerManager.terminate();
  process.exit(0);
});
