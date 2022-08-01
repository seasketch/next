import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  useGetBasemapsQuery,
  useLayersAndSourcesForItemsQuery,
  usePublishedTableOfContentsQuery,
} from "../generated/graphql";
import {
  ClientBasemap,
  ClientDataLayer,
  ClientDataSource,
  MapContextInterface,
} from "./MapContextManager";
import { ClientTableOfContentsItem } from "./tableOfContents/TableOfContents";

/**
 * Retrieves published table of contents items, basemaps,
 * data sources and data layers. Also updates the given
 * map context with these values.
 */
export default function useMapData(mapContext: MapContextInterface) {
  const { slug } = useParams<{ slug: string }>();
  const [basemaps, setBasemaps] = useState<ClientBasemap[]>([]);
  const [tableOfContentsItems, setTableOfContentsItems] = useState<
    ClientTableOfContentsItem[]
  >([]);
  const [dataLayers, setDataLayers] = useState<ClientDataLayer[]>([]);
  const [dataSources, setDataSources] = useState<ClientDataSource[]>([]);

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
        .basemaps as ClientBasemap[];
      if (mapContext.manager) {
        mapContext.manager.setBasemaps(basemaps);
      }
      setBasemaps(basemaps);
    }
  }, [mapContext.manager, basemapsQuery.data]);

  useEffect(() => {
    if (tocQuery.data?.projectBySlug?.tableOfContentsItems) {
      setTableOfContentsItems(
        tocQuery.data.projectBySlug
          .tableOfContentsItems as ClientTableOfContentsItem[]
      );
    }
  }, [tocQuery.data]);

  useEffect(() => {
    if (
      layersAndSourcesQuery.data?.projectBySlug?.dataLayersForItems &&
      layersAndSourcesQuery.data?.projectBySlug?.dataSourcesForItems
    ) {
      const layers = layersAndSourcesQuery.data.projectBySlug
        .dataLayersForItems as ClientDataLayer[];
      const sources = layersAndSourcesQuery.data.projectBySlug
        .dataSourcesForItems as ClientDataSource[];
      if (mapContext.manager) {
        mapContext.manager.reset(sources, layers);
        setDataLayers(layers);
        setDataSources(sources);
      }
    }
  }, [layersAndSourcesQuery.data, mapContext.manager]);
  return { basemaps, tableOfContentsItems, dataSources, dataLayers };
}
