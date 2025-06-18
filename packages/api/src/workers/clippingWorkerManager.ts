import { Worker } from "worker_threads";
import { join } from "path";
import {
  clipSketchToPolygons,
  Cql2Query,
  PolygonClipResult,
} from "overlay-engine";
import { Feature, MultiPolygon, Polygon } from "geojson";

interface PreparedSketch {
  feature: Feature<any>;
  envelopes: any[];
}

interface ClippingWorkerData {
  preparedSketch: PreparedSketch;
  op: string;
  cql2Query?: Cql2Query;
  polygons: Feature<MultiPolygon | Polygon>[];
}

interface ClippingWorkerResult {
  success: boolean;
  result?: any;
  error?: string;
}

class ClippingWorkerManager {
  private worker: Worker | null = null;

  private async getWorker(): Promise<Worker> {
    if (!this.worker) {
      const workerPath = join(__dirname, "clippingWorker.js");
      this.worker = new Worker(workerPath);
    }
    return this.worker;
  }

  async clipSketchToPolygonsWithWorker(
    preparedSketch: PreparedSketch,
    op: string,
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

    // Use the worker thread for all operations
    const worker = await this.getWorker();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Clipping operation timed out"));
      }, 8000); // 8 second timeout

      const messageHandler = (result: ClippingWorkerResult) => {
        clearTimeout(timeout);
        worker.off("message", messageHandler);

        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error || "Unknown worker error"));
        }
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.off("error", errorHandler);
        reject(error);
        this.terminate();
      };

      worker.on("message", messageHandler);
      worker.on("error", errorHandler);

      const data: ClippingWorkerData = {
        preparedSketch,
        op,
        cql2Query,
        polygons,
      };

      worker.postMessage(data);
    });
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
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
