import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { DOMParser } from "prosemirror-model";
import { JSDOM } from "jsdom";
import { schema } from "../prosemirror/basicSchema";

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
  const descriptionText = pickDescription(mapServerInfo, layer);

  // if description contains html, convert to prosemirror
  const hasHtml = descriptionText
    ? /<[a-z][\s\S]*>/i.test(descriptionText)
    : false;
  let description: any | null = null;
  if (hasHtml) {
    const dom = new JSDOM(descriptionText as string);
    const document = dom.window.document;
    const body = document.querySelector("body");
    // @ts-ignore
    const parsedDocument = DOMParser.fromSchema(schema).parse(body);
    description = parsedDocument.toJSON().content;
  } else if (descriptionText && descriptionText.length > 0) {
    description = [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: descriptionText || "",
          },
        ],
      },
    ];
  }

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
      ...(description ? description : []),
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

function decodeUnicode(encodedString: string) {
  // Replace Unicode escape sequences with corresponding characters
  const unicodeDecoded = encodedString.replace(
    /\\u[\dA-F]{4}/gi,
    function (match) {
      return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16));
    }
  );

  // Remove any remaining HTML tags if needed (since you want plain text)
  return unicodeDecoded.replace(/<\/?[^>]+(>|$)/g, "");
}
