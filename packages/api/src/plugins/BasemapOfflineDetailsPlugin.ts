import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { RasterDemSource, RasterSource, Style, VectorSource } from "mapbox-gl";
import flatten from "lodash.flatten";

function normalizeStyleUrl(styleUrl: string, mapboxApiKey: string) {
  let url = styleUrl;
  const [mbox, blank, styles, username, styleId] = styleUrl.split("/");
  url = `https://api.mapbox.com/styles/v1/${username}/${styleId}?access_token=${mapboxApiKey}`;
  return url;
}

const BasemapOfflineDetailsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql, inflection } = build;
  return {
    typeDefs: gql`
      enum CacheableOfflineAssetType {
        IMAGE
        FONT
        MAPBOX_GL_STYLE
        JSON
        SPRITE
      }

      type CacheableOfflineAsset {
        url: String!
        """
        If provided, is a "bare" url with query strings such as access_token
        stripped out.
        """
        cacheKey: String
        type: CacheableOfflineAssetType!
      }

      type OfflineSourceDetails {
        dataSourceUrl: String!
        """
        Whether a tile packages is available for download
        """
        tilePackages: [OfflineTilePackage!]!
        type: OfflineTilePackageSourceType!
        templateUrl: String!
      }

      """
      Provides information on resources necessary to use a basemap offline
      """
      type OfflineSupportInformation {
        id: ID!
        staticAssets: [CacheableOfflineAsset!]!
        sources: [OfflineSourceDetails!]!
        hasUncacheableSources: Boolean!
        styleLastModified: Date
      }

      extend type Basemap {
        """
        Only available on supported projects by authorized users
        """
        offlineSupportInformation: OfflineSupportInformation
          @requires(columns: ["url", "project_id", "is_mapbox_hosted"])
      }
    `,
    resolvers: {
      OfflineSupportInformation: {
        sources: async (parent, args, context, resolveInfo) => {
          const returnValue = parent.validSources.map(
            (source: VectorSource | RasterSource | RasterDemSource) => {
              const dataSourceUrl = source.tiles
                ? source.tiles[0]
                : source.url!;
              const tilePackages = parent.offlineTilePackages.filter(
                (pkg: { data_source_url: string }) =>
                  pkg.data_source_url === dataSourceUrl
              );
              return {
                templateUrl: normalizeSourceUrlTemplate(
                  dataSourceUrl,
                  source.type
                ),
                dataSourceUrl,
                type: source.type,
                tilePackageIds: tilePackages.map(
                  (pkg: { id: string }) => pkg.id
                ),
                ready: Boolean(
                  tilePackages.find(
                    (p: { status: string }) => p.status === "complete"
                  )
                ),
              };
            }
          );
          return returnValue;
        },
      },
      OfflineSourceDetails: {
        tilePackages: async (parent, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.offline_tile_packages`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ANY(${sql.value(
                  parent.tilePackageIds
                )})`
              );
            }
          );
        },
      },
      Basemap: {
        offlineSupportInformation: async (
          basemap,
          args,
          context,
          resolveInfo
        ) => {
          let styleUrl = basemap.url;
          let cacheKey: undefined | string;
          let apiKey: string | undefined;
          if (/^mapbox:/.test(basemap.url)) {
            apiKey = await context.loaders.mapboxApiKey.load(basemap.projectId);
            styleUrl = normalizeStyleUrl(styleUrl, apiKey!);
            const key = new URL(styleUrl);
            key.searchParams.delete("access_token");
            cacheKey = key.toString();
          }
          const style = (await context.loaders.style.load(
            styleUrl.toString()
          )) as Style;

          const validSources = Object.values(style.sources).filter(
            (s) => s.type === "vector" || s.type === "raster"
            // disable raster-dem for now
            // || s.type === "raster-dem"
          ) as (VectorSource | RasterDemSource | RasterSource)[];

          const sourceUrls = validSources.reduce((urls, source) => {
            const url = source.tiles ? source.tiles[0] : source.url!;
            if (urls.indexOf(url) === -1) {
              urls.push(url);
            }
            return urls;
          }, [] as string[]);

          const offlineTilePackages: any[] = flatten(
            await Promise.all(
              sourceUrls.map((url) => {
                const key = `${basemap.projectId}\n${url}`;
                return context.loaders.offlineTilePackageBySource.load(key);
              })
            )
          );

          // Gather up needed static assets
          const staticAssets: {
            type: "IMAGE" | "FONT" | "MAPBOX_GL_STYLE" | "JSON" | "SPRITE";
            url: string;
            cacheKey?: string;
          }[] = [
            {
              type: "MAPBOX_GL_STYLE",
              url: styleUrl,
              cacheKey,
            },
          ];

          function addAsset(asset: {
            type: "IMAGE" | "FONT" | "MAPBOX_GL_STYLE" | "JSON" | "SPRITE";
            url: string;
            cacheKey?: string;
          }) {
            if (!staticAssets.find((a) => a.url === asset.url)) {
              staticAssets.push(asset);
            }
          }

          for (const source of validSources) {
            const url = source.tiles ? source.tiles[0] : source.url!;
            // add tilejson for mapbox sources
            if (/mapbox:/.test(url)) {
              // add tilejson
              const [_, sourceList] = url.split("//");
              const tileJsonUrl = `https://api.mapbox.com/v4/${sourceList}.json?access_token=${apiKey!}`;
              staticAssets.push({
                url: tileJsonUrl,
                type: "JSON",
                cacheKey: tileJsonUrl.split("?")[0],
              });
            }
          }

          // add glyphs
          if (style.glyphs) {
            const fontStacks: string[] = [];
            for (const layer of style.layers) {
              if ("layout" in layer && layer.layout) {
                if ("text-font" in layer.layout) {
                  const textFont = layer.layout["text-font"];
                  if (Array.isArray(textFont)) {
                    // exclude expressions. TODO: support expressions
                    if (!textFont.find((el) => typeof el !== "string")) {
                      const stack = textFont.join(",");
                      if (fontStacks.indexOf(stack) === -1) {
                        fontStacks.push(stack);
                      }
                    }
                  }
                }
              }
            }
            for (const stack of fontStacks) {
              let url = style
                .glyphs!.replace("{fontstack}", stack)
                .replace("{range}", "0-255");
              if (/^mapbox:/.test(style.glyphs!)) {
                url = `https://api.mapbox.com/fonts/v1/mapbox/${encodeURIComponent(
                  stack
                )}/0-255.pbf?access_token=${apiKey}`;
              }
              addAsset({
                type: "FONT",
                url,
                cacheKey: url.split("?")[0],
              });
            }
          }
          // add sprites
          // Useful background - https://docs.mapbox.com/mapbox-gl-js/style-spec/sprite/#loading-sprite-files
          if (style.sprite) {
            const variants = ["1x", "2x"];
            if (/mapbox:/.test(style.sprite)) {
              const id = style.sprite.replace("mapbox://sprites/", "");
              for (const variant of variants) {
                const jsonUrl = `https://api.mapbox.com/styles/v1/${id}/sprite@${variant}.json?access_token=${apiKey}`;
                addAsset({
                  url: jsonUrl,
                  cacheKey: jsonUrl.split("?")[0],
                  type: "SPRITE",
                });
                const pngUrl = `https://api.mapbox.com/styles/v1/${id}/sprite@${variant}.png?access_token=${apiKey}`;
                addAsset({
                  url: pngUrl,
                  cacheKey: pngUrl.split("?")[0],
                  type: "SPRITE",
                });
              }
            } else {
              for (const variant of variants) {
                const jsonUrl = `${style.sprite!}@${variant}.json`;
                addAsset({
                  url: jsonUrl,
                  type: "SPRITE",
                });
                const pngUrl = `${style.sprite!}@${variant}.png`;
                addAsset({
                  url: pngUrl,
                  type: "SPRITE",
                });
              }
            }
          }

          return {
            id: basemap.id,
            hasUncacheableSources:
              validSources.length > Object.values(style.sources).length,
            validSources,
            offlineTilePackages,
            projectId: basemap.projectId,
            styleUrl: styleUrl.toString(),
            basemapId: basemap.id,
            style: style,
            staticAssets,
            tilePackageIds: offlineTilePackages,
            styleLastModified:
              "modified" in style
                ? new Date((style as any).modified as string)
                : undefined,
          };
        },
      },
    },
  };
});

export function normalizeSourceUrlTemplate(
  sourceUrl: string,
  sourceType: "raster" | "raster-dem" | "vector"
) {
  let url = sourceUrl;
  if (/^mapbox:/.test(sourceUrl)) {
    const sourceList = sourceUrl.replace("mapbox://", "");
    switch (sourceType) {
      case "vector":
        url = `https://api.mapbox.com/v4/${sourceList}/{z}/{x}/{y}.vector.pbf`;
        break;
      case "raster":
        url = `https://api.mapbox.com/v4/${sourceList}/{z}/{x}/{y}@2x.webp`;
        break;
      case "raster-dem":
        url = `https://api.mapbox.com/v4/${sourceList}/{z}/{x}/{y}@2x.webp`;
        break;
      default:
        break;
    }
  }
  return url;
}

export default BasemapOfflineDetailsPlugin;
