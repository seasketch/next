import { clipSketchToPolygons } from "overlay-engine";
import { ClippingWorkerData } from "./types";

export default async function (data: ClippingWorkerData) {
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

    return result;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}
