import { dedupeCompleteSpatialMetrics } from "./dedupeMetrics";
import {
  getSamoaCardDependencyList,
  getSamoaMetric,
} from "../testData/samoaFixture";

describe("dedupeCompleteSpatialMetrics with Samoa fixture data", () => {
  test("dedupes duplicate metric ids from a real card dependency list", () => {
    const card = getSamoaCardDependencyList(2577);
    const metricsWithDuplicateIds = card.metrics.map((id: string) =>
      getSamoaMetric(id)
    );

    expect(metricsWithDuplicateIds).toHaveLength(74);
    expect(new Set(card.metrics).size).toBe(70);

    const deduped = dedupeCompleteSpatialMetrics(metricsWithDuplicateIds as any);

    expect(deduped).toHaveLength(70);
    expect(new Set(deduped.map((metric) => metric.id)).size).toBe(70);
  });
});
