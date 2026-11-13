type StyleLayer = {
  id?: string;
  source?: string;
};

type StyleLike = {
  layers?: StyleLayer[];
  sources?: { [id: string]: unknown };
  terrain?: { source?: string };
};

/**
 * Drop sketch, drawing, and filter layers from a captured map style so a
 * layer-link screenshot shows the basemap and the one overlay.
 */
export function stripEphemeralLayers<T extends StyleLike>(
  style: T,
  removeLayerIds: string[]
): T {
  const remove = new Set(removeLayerIds);
  const layers = (style.layers || []).filter((layer) => {
    const id = layer.id || "";
    if (remove.has(id)) {
      return false;
    }
    if (id.indexOf("gl-draw") === 0) {
      return false;
    }
    if (id.indexOf("filter-layer-") === 0) {
      return false;
    }
    if (id === "all-cells") {
      return false;
    }
    if (
      typeof layer.source === "string" &&
      layer.source.indexOf("sketch-") === 0
    ) {
      return false;
    }
    return true;
  });
  const used = new Set<string>();
  for (const layer of layers) {
    if (typeof layer.source === "string") {
      used.add(layer.source);
    }
  }
  if (style.terrain && typeof style.terrain.source === "string") {
    used.add(style.terrain.source);
  }
  const sources: { [id: string]: unknown } = {};
  const originalSources = style.sources || {};
  for (const key of Object.keys(originalSources)) {
    if (used.has(key)) {
      sources[key] = originalSources[key];
    }
  }
  return {
    ...style,
    layers,
    sources,
  };
}
