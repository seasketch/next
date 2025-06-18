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
  requestId: string;
  preparedSketch: PreparedSketch;
  op: string;
  cql2Query?: Cql2Query;
  polygons: Feature<MultiPolygon | Polygon>[];
}

interface ClippingWorkerResult {
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
}

class ClippingWorkerManager {
  private workers: Worker[] = [];
  private maxWorkers: number;
  private currentWorkerIndex: number = 0;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getWorker(): Promise<Worker> {
    // Create a new worker for each operation to avoid race conditions
    const workerPath = join(__dirname, "clippingWorker.js");
    const worker = new Worker(workerPath);

    // Add to pool for cleanup
    this.workers.push(worker);

    // Clean up old workers if we have too many
    if (this.workers.length > this.maxWorkers) {
      const oldWorker = this.workers.shift();
      if (oldWorker) {
        await oldWorker.terminate();
      }
    }

    return worker;
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

    // Create a new worker for this operation
    const worker = await this.getWorker();
    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Clipping operation timed out"));
      }, 8000); // 8 second timeout

      const messageHandler = (result: ClippingWorkerResult) => {
        // Only handle messages for this specific request
        if (result.requestId !== requestId) {
          return;
        }

        clearTimeout(timeout);
        worker.off("message", messageHandler);
        worker.off("error", errorHandler);

        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error || "Unknown worker error"));
        }

        // Clean up this worker after use
        worker.terminate().catch(() => {
          // Ignore termination errors
        });

        // Remove from pool
        const index = this.workers.indexOf(worker);
        if (index > -1) {
          this.workers.splice(index, 1);
        }
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        worker.off("message", messageHandler);
        worker.off("error", errorHandler);
        reject(error);

        // Clean up this worker after error
        worker.terminate().catch(() => {
          // Ignore termination errors
        });

        // Remove from pool
        const index = this.workers.indexOf(worker);
        if (index > -1) {
          this.workers.splice(index, 1);
        }
      };

      worker.on("message", messageHandler);
      worker.on("error", errorHandler);

      const data: ClippingWorkerData = {
        requestId,
        preparedSketch,
        op,
        cql2Query,
        polygons,
      };

      worker.postMessage(data);
    });
  }

  async terminate(): Promise<void> {
    const terminationPromises = this.workers.map((worker) =>
      worker.terminate().catch(() => {
        // Ignore termination errors
      })
    );
    await Promise.all(terminationPromises);
    this.workers = [];
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
