import React, { ReactNode } from "react";
import DefinitionList from "../../../components/DefinitionList";
import { LayerInfo, MapServerCatalogInfo } from "./arcgis";

export interface ArcGISServiceMetadataProps {
  serviceInfo: MapServerCatalogInfo;
  layer?: LayerInfo;
}

export default function ArcGISServiceMetadata(
  props: ArcGISServiceMetadataProps
) {
  const mapServerInfo = props.serviceInfo;
  let definitionListItems: [string, string | ReactNode][] = [];
  if (props.layer) {
    definitionListItems.push(
      ["Description", props.layer?.description],
      ["Author", mapServerInfo.documentInfo?.Author],
      ["Copyright", props.layer?.copyrightText || mapServerInfo.copyrightText],
      [
        "Projection",

        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={`https://epsg.io/${
            mapServerInfo.spatialReference.latestWkid ||
            mapServerInfo.spatialReference.wkid
          }`}
        >
          {mapServerInfo.spatialReference.latestWkid ||
            mapServerInfo.spatialReference.wkid}
        </a>,
      ]
    );
  } else {
    definitionListItems.push(
      [
        "Description",
        mapServerInfo.serviceDescription || mapServerInfo.description,
      ],
      ["Author", mapServerInfo.documentInfo?.Author],
      ["Subject", mapServerInfo.documentInfo?.Subject],
      ["Comments", mapServerInfo.documentInfo?.Comments],
      ["Copyright", mapServerInfo.copyrightText],
      ["Keywords", mapServerInfo.documentInfo?.Keywords],
      [
        "Projection",

        <a
          className="underline"
          target="_blank"
          rel="noreferrer"
          href={`https://epsg.io/${
            mapServerInfo.spatialReference.latestWkid ||
            mapServerInfo.spatialReference.wkid
          }`}
        >
          {mapServerInfo.spatialReference.latestWkid ||
            mapServerInfo.spatialReference.wkid}
        </a>,
      ]
    );
  }
  return (
    <div>
      <DefinitionList items={definitionListItems} />
    </div>
  );
}
