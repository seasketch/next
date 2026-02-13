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

export interface UseMapDataOptions {
  /** When true, use draft table of contents (for admin preview). Default: false (published). */
  draft?: boolean;
}

/**
 * Pure data-fetching hook. Returns basemaps, table of contents items,
 * data layers, and data sources for the current project.
 */
export default function useMapData(options?: UseMapDataOptions) {
  const { draft = false } = options ?? {};
  const { slug } = useParams<{ slug: string }>();
  const [basemaps, setBasemaps] = useState<
    BasemapDetailsFragment[] | undefined
  >(undefined);
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
      setBasemaps(
        basemapsQuery.data.projectBySlug.basemaps as BasemapDetailsFragment[]
      );
    }
  }, [basemapsQuery.data]);

  useEffect(() => {
    if (tocItems) {
      setTableOfContentsItems(tocItems);
    }
  }, [tocItems]);

  useEffect(() => {
    if (
      layersAndSourcesQuery.data?.projectBySlug?.dataLayersForItems &&
      layersAndSourcesQuery.data?.projectBySlug?.dataSourcesForItems
    ) {
      setDataLayers(
        layersAndSourcesQuery.data.projectBySlug.dataLayersForItems
      );
      setDataSources(
        layersAndSourcesQuery.data.projectBySlug.dataSourcesForItems
      );
    }
  }, [layersAndSourcesQuery.data]);

  return { basemaps, tableOfContentsItems, dataSources, dataLayers };
}
