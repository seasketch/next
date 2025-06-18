import { parentPort, workerData } from "worker_threads";
import {
  clipSketchToPolygons,
  ClippingOperation,
  prepareSketch,
  Cql2Query,
} from "overlay-engine";
import { Feature, MultiPolygon, Polygon } from "geojson";

interface ClippingWorkerData {
  preparedSketch: any; // Using any to avoid complex type imports
  op: ClippingOperation;
  cql2Query?: Cql2Query;
  polygons: Feature<MultiPolygon | Polygon>[];
}

interface ClippingWorkerResult {
  success: boolean;
  result?: any;
  error?: string;
}

async function performClipping(
  data: ClippingWorkerData
): Promise<ClippingWorkerResult> {
  try {
    // Convert the polygons array to an async iterable
    const polygonSource = (async function* () {
      for (const polygon of data.polygons) {
        yield polygon;
      }
    })();

    const result = await clipSketchToPolygons(
      data.preparedSketch,
      data.op,
      data.cql2Query,
      polygonSource
    );

    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Handle messages from the main thread
parentPort?.on("message", async (data: ClippingWorkerData) => {
  const result = await performClipping(data);
  parentPort?.postMessage(result);
});

// Handle worker termination
process.on("exit", () => {
  parentPort?.close();
});
