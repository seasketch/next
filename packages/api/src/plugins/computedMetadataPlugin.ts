import { makeExtendSchemaPlugin, gql } from "graphile-utils";

const ComputedMetadataPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      extend type TableOfContentsItem {
        """
        Metadata will be returned as directly stored in the SeaSketch
        database or computed by fetching from a 3rd party service,
        depending on the data source type.
        """
        computedMetadata: JSON @requires(columns: ["metadata", "data_layer_id"])
      }
    `,
    resolvers: {
      TableOfContentsItem: {
        // metadataXMLUrl: async (item, args, context, info) => {
        //   if (item.dataLayerId) {
        //     // first, get the data_source_id
        //     const q = await context.pgClient.query(
        //       `select data_source_id from data_layers where id = $1`,
        //       [item.dataLayerId]
        //     );
        //     if (q.rows.length === 0) {
        //       return null;
        //     }
        //     // then look for a data_upload_output with type = XMLMetadata
        //     const { data_source_id } = q.rows[0];
        //     const { rows } = await context.pgClient.query(
        //       `select url from data_upload_outputs where data_source_id = $1 and type = 'XMLMetadata'`,
        //       [data_source_id]
        //     );
        //     if (rows.length === 0) {
        //       return null;
        //     }
        //     return rows[0].url;
        //   }
        //   return null;
        // },
        computedMetadata: async (item, args, context, info) => {
          if (item.metadata) {
            return item.metadata;
          } else if (item.dataLayerId) {
            const q = await context.pgClient.query(
              `select data_source_id, sublayer from data_layers where id = $1`,
              [item.dataLayerId]
            );
            if (q.rows.length === 0) {
              return null;
            }
            const { data_source_id, sublayer } = q.rows[0];
            let { rows } = await context.pgClient.query(
              `select type, url from data_sources where id = $1`,
              [data_source_id]
            );
            if (rows.length === 0) {
              return null;
            }
            const { type, url } = rows[0];
            switch (type) {
              case "arcgis-vector":
              case "arcgis-dynamic-mapserver":
              case "arcgis-raster-tiles":
                const serviceMetadataResponse = await fetch(
                  `${url.replace(/\d+[\/]*$/, "")}?f=json`
                );
                const serviceMetadata = await serviceMetadataResponse.json();

                const response = await fetch(
                  `${url}${sublayer !== null ? `/${sublayer}` : ""}?f=json`
                );
                const layerMetadata = await response.json();
                return generateMetadataForLayer(
                  url,
                  serviceMetadata,
                  layerMetadata
                );
              default:
                return null;
            }
          } else {
            return null;
          }
        },
      },
    },
  };
});

// TODO: Replace these metadata generation functions with those exported
// from @seasketch/mapbox-gl-esri-sources.
// Right now I'm having trouble getting the server to build when importing
// that package.

export function contentOrFalse(str?: string) {
  if (str && str.length > 0) {
    return str;
  } else {
    return false;
  }
}

function pickDescription(info: any, layer?: any) {
  return (
    contentOrFalse(layer?.description) ||
    contentOrFalse(info.description) ||
    contentOrFalse(info.documentInfo?.Subject) ||
    contentOrFalse(info.documentInfo?.Comments)
  );
}

export function generateMetadataForLayer(
  url: string,
  mapServerInfo: any,
  layer: any
) {
  const attribution =
    contentOrFalse(layer.copyrightText) ||
    contentOrFalse(mapServerInfo.copyrightText) ||
    contentOrFalse(mapServerInfo.documentInfo?.Author);
  const description = pickDescription(mapServerInfo, layer);
  let keywords =
    mapServerInfo.documentInfo?.Keywords &&
    mapServerInfo.documentInfo?.Keywords.length
      ? mapServerInfo.documentInfo?.Keywords.split(",")
      : [];
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [
          {
            type: "text",
            text: layer.name || mapServerInfo.documentInfo?.Title || "",
          },
        ],
      },
      ...(description
        ? [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description || "",
                },
              ],
            },
          ]
        : []),
      ...(attribution
        ? [
            { type: "paragraph" },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Attribution" }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: attribution,
                },
              ],
            },
          ]
        : []),
      ...(keywords && keywords.length
        ? [
            { type: "paragraph" },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [
                {
                  type: "text",
                  text: "Keywords",
                },
              ],
            },
            {
              type: "bullet_list",
              marks: [],
              attrs: {},
              content: keywords.map((word: any) => ({
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: word || "" }],
                  },
                ],
              })),
            },
          ]
        : []),
      { type: "paragraph" },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [
              {
                type: "link",
                attrs: {
                  href: url,
                  title: "ArcGIS Server",
                },
              },
            ],
            text: url,
          },
        ],
      },
    ],
  };
}

export default ComputedMetadataPlugin;
