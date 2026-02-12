import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  BasemapDetailsFragment,
  DataLayerDetailsFragment,
  DataSourceDetailsFragment,
  OverlayFragment,
  useGetBasemapsQuery,
  useLayersAndSourcesForItemsQuery,
  usePublishedTableOfContentsQuery,
  useDraftTableOfContentsQuery,
} from "../generated/graphql";
import MapContextManager from "./MapContextManager";

export interface UseMapDataOptions {
  /** When true, use draft table of contents (for admin preview). Default: false (published). */
  draft?: boolean;
}

/**
 * Retrieves table of contents items, basemaps, data sources and data layers.
 * Also updates the given map context with these values.
 * @param draft When true, uses draft ToC for admin preview (interactivity changes reflect immediately).
 */
export default function useMapData(
  manager: MapContextManager | undefined,
  options?: UseMapDataOptions
) {
  const { draft = false } = options ?? {};
  const { slug } = useParams<{ slug: string }>();
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  const [tableOfContentsItems, setTableOfContentsItems] = useState<
    OverlayFragment[]
  >([]);
  const [dataLayers, setDataLayers] = useState<DataLayerDetailsFragment[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceDetailsFragment[]>(
    []
  );

  const publishedTocQuery = usePublishedTableOfContentsQuery({
    variables: { slug },
    skip: draft,
  });
  const draftTocQuery = useDraftTableOfContentsQuery({
    variables: { slug },
    skip: !draft,
  });
  const tocItems = draft
    ? draftTocQuery.data?.projectBySlug?.draftTableOfContentsItems
    : publishedTocQuery.data?.projectBySlug?.tableOfContentsItems;

  const layersAndSourcesQuery = useLayersAndSourcesForItemsQuery({
    variables: {
      slug,
      tableOfContentsItemIds: tocItems?.map((t: { id: number }) => t.id) ?? [],
    },
    skip: !tocItems,
  });
  const basemapsQuery = useGetBasemapsQuery({
    variables: {
      slug,
    },
  });
  useEffect(() => {
    if (basemapsQuery.data?.projectBySlug?.basemaps) {
      const basemaps = basemapsQuery.data.projectBySlug
        .basemaps as BasemapDetailsFragment[];
      if (manager) {
        manager.setBasemaps(basemaps);
      }
      setBasemaps(basemaps);
    }
  }, [manager, basemapsQuery.data]);

  useEffect(() => {
    if (tocItems) {
      setTableOfContentsItems(tocItems);
    }
  }, [tocItems]);

  useEffect(() => {
    if (
      layersAndSourcesQuery.data?.projectBySlug?.dataLayersForItems &&
      layersAndSourcesQuery.data?.projectBySlug?.dataSourcesForItems &&
      tocItems
    ) {
      const layers =
        layersAndSourcesQuery.data.projectBySlug.dataLayersForItems;
      const sources =
        layersAndSourcesQuery.data.projectBySlug.dataSourcesForItems;
      if (manager) {
        manager.reset(sources, layers, tocItems);
      }
      setDataLayers(layers);
      setDataSources(sources);
    }
  }, [layersAndSourcesQuery.data, manager, tocItems]);
  return { basemaps, tableOfContentsItems, dataSources, dataLayers };
}
