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
} from "../generated/graphql";
import { MapContextInterface } from "./MapContextManager";

/**
 * Retrieves published table of contents items, basemaps,
 * data sources and data layers. Also updates the given
 * map context with these values.
 */
export default function useMapData(mapContext: MapContextInterface) {
  const { slug } = useParams<{ slug: string }>();
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  const [tableOfContentsItems, setTableOfContentsItems] = useState<
    OverlayFragment[]
  >([]);
  const [dataLayers, setDataLayers] = useState<DataLayerDetailsFragment[]>([]);
  const [dataSources, setDataSources] = useState<DataSourceDetailsFragment[]>(
    []
  );

  const tocQuery = usePublishedTableOfContentsQuery({
    variables: {
      slug,
    },
  });
  const layersAndSourcesQuery = useLayersAndSourcesForItemsQuery({
    variables: {
      slug,
      tableOfContentsItemIds:
        tocQuery.data?.projectBySlug?.tableOfContentsItems?.map((t) => t.id) ||
        [],
    },
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
      if (mapContext.manager) {
        mapContext.manager.setBasemaps(basemaps);
      }
      setBasemaps(basemaps);
    }
  }, [mapContext.manager, basemapsQuery.data]);

  useEffect(() => {
    if (tocQuery.data?.projectBySlug?.tableOfContentsItems) {
      setTableOfContentsItems(tocQuery.data.projectBySlug.tableOfContentsItems);
    }
  }, [tocQuery.data]);

  useEffect(() => {
    if (
      layersAndSourcesQuery.data?.projectBySlug?.dataLayersForItems &&
      layersAndSourcesQuery.data?.projectBySlug?.dataSourcesForItems
    ) {
      const layers =
        layersAndSourcesQuery.data.projectBySlug.dataLayersForItems;
      const sources =
        layersAndSourcesQuery.data.projectBySlug.dataSourcesForItems;
      if (mapContext.manager) {
        mapContext.manager.reset(
          sources,
          layers,
          tocQuery.data?.projectBySlug?.tableOfContentsItems || []
        );
        setDataLayers(layers);
        setDataSources(sources);
      }
    }
  }, [
    layersAndSourcesQuery.data,
    mapContext.manager,
    tocQuery.data?.projectBySlug?.tableOfContentsItems,
  ]);
  return { basemaps, tableOfContentsItems, dataSources, dataLayers };
}
