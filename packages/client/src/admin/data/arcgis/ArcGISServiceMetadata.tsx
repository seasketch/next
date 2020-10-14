import React, { ReactNode } from "react";
import DefinitionList from "../../../components/DefinitionList";
import { MapServerCatalogInfo } from "./arcgis";

export interface ArcGISServiceMetadataProps {
  serviceInfo: MapServerCatalogInfo;
}

export default function ArcGISServiceMetadata(
  props: ArcGISServiceMetadataProps
) {
  const mapServerInfo = props.serviceInfo;
  const definitionListItems: [string, string | ReactNode][] = [
    [
      "Description",
      mapServerInfo.serviceDescription || mapServerInfo.description,
    ],
    ["Author", mapServerInfo.documentInfo.Author],
    ["Subject", mapServerInfo.documentInfo.Subject],
    ["Comments", mapServerInfo.documentInfo.Comments],
    ["Copyright", mapServerInfo.copyrightText],
    ["Keywords", mapServerInfo.documentInfo.Keywords],
    [
      "Projection",

      <a
        className="underline"
        target="_blank"
        href={`https://epsg.io/${
          mapServerInfo.spatialReference.latestWkid ||
          mapServerInfo.spatialReference.wkid
        }`}
      >
        {mapServerInfo.spatialReference.latestWkid ||
          mapServerInfo.spatialReference.wkid}
      </a>,
    ],
  ];
  return (
    <div>
      <DefinitionList items={definitionListItems} />
    </div>
  );
}
