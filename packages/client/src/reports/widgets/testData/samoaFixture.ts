const samoaExample = require("./samoa-example.json");

export const samoaDependencies = samoaExample.report.dependencies;

export function getSamoaSource(stableId: string) {
  const source = samoaDependencies.overlaySources.find(
    (candidate: any) => candidate.stableId === stableId
  );
  if (!source) {
    throw new Error(`Samoa source not found: ${stableId}`);
  }
  return source;
}

export function getSamoaMetric(id: string) {
  const metric = samoaDependencies.metrics.find(
    (candidate: any) => candidate.id === id
  );
  if (!metric) {
    throw new Error(`Samoa metric not found: ${id}`);
  }
  return metric;
}

export function getSamoaCardDependencyList(cardId: number) {
  const card = samoaDependencies.cardDependencyLists.find(
    (candidate: any) => candidate.cardId === cardId
  );
  if (!card) {
    throw new Error(`Samoa card dependency list not found: ${cardId}`);
  }
  return card;
}

export function getSamoaCardSources(cardId: number) {
  const card = getSamoaCardDependencyList(cardId);
  return card.overlaySources.map((stableId: string) => getSamoaSource(stableId));
}

export function getSamoaCardMetrics(cardId: number) {
  const card = getSamoaCardDependencyList(cardId);
  return card.metrics.map((id: string) => getSamoaMetric(id));
}
