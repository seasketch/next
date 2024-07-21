import { Client, PoolClient } from "pg";
import { ProcessedUploadLayer } from "spatial-uploads-handler";
import { customAlphabet } from "nanoid";
import { GeoJsonGeometryTypes } from "geojson";
import {
  GeostatsLayer,
  RasterInfo,
  SuggestedRasterPresentation,
  isRasterInfo,
} from "@seasketch/geostats-types";
import * as colorScale from "d3-scale-chromatic";
import { colord } from "colord";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const nanoId = customAlphabet(alphabet, 9);

/**
 * Creates database records for a processed upload. This includes:
 *  * data_sources
 *  * data_layers
 *  * table_of_contents_items
 *
 * For data layers this includes choosing a default cartographic style
 *
 * @param layer ProcessedUploadLayer
 * @param projectId the project id
 * @param client pg client
 * @param uploadTaskId the upload task id
 * @returns
 */
export async function createDBRecordsForProcessedLayer(
  layer: ProcessedUploadLayer,
  projectId: number,
  client: PoolClient | Client,
  jobId: string,
  jobType: "upload" | "conversion",
  replace?: {
    sourceId: number;
    layerId: number;
  }
) {
  const uploadCountResult = await client.query(
    `
      select 
        row_number 
      from (
        select
          id, 
          row_number() over (order by created_at) 
        from 
          project_background_jobs 
        where project_id = $1
      ) as foo 
      where id = $2`,
    [projectId, jobId]
  );
  let uploadCount = parseInt(uploadCountResult.rows[0].row_number);
  const isVector = layer.outputs.find((o) => o.type === "FlatGeobuf");
  const normalizedOutput = layer.outputs.find((o) => o.isNormalizedOutput);
  const geojson = layer.outputs.find((output) => output.type === "GeoJSON");
  const original = layer.outputs.find((output) => output.isOriginal);
  if (!normalizedOutput) {
    throw new Error("Normalized output not listed in outputs");
  }
  if (!original) {
    throw new Error("Original not listed in outputs");
  }
  const pmtiles = layer.outputs.find((output) => output.type === "PMTiles");
  let bucketId: string | null = null;
  let objectKey: string | null = null;
  if (geojson && /s3:\/\//.test(geojson.remote)) {
    bucketId = geojson.remote.replace("s3://", "").split("/")[0];
    objectKey = geojson.remote
      .replace("s3://", "")
      .split("/")
      .slice(1)
      .join("/");
  }

  let uploadTaskId: number | null = null;
  let uploadedBy: number | null = null;
  let changelog: string | null = null;
  if (jobType === "upload") {
    const q = await client.query(
      `
      select
        id,
        changelog
      from
        data_upload_tasks
      where
        project_background_job_id = $1
      limit 1
    `,
      [jobId]
    );
    if (q.rows.length === 0) {
      throw new Error("Could not find upload task related to background job");
    }
    uploadTaskId = q.rows[0].id;
    changelog = q.rows[0].changelog;
  } else if (jobType === "conversion") {
    changelog =
      "Converted from ESRI Feature Layer to vector data hosted on SeaSketch.";
  }

  const userResults = await client.query(
    `
      select user_id from project_background_jobs where id = $1
    `,
    [jobId]
  );
  if (userResults.rows.length === 0) {
    throw new Error("Could not find user_id for background job");
  }
  uploadedBy = userResults.rows[0].user_id;

  const conversionTaskQuery = await client.query(
    `
      select 
        location, 
        table_of_contents_item_id,
        mapbox_gl_styles,
        metadata,
        attribution
      from 
        esri_feature_layer_conversion_tasks 
      where project_background_job_id = $1 limit 1
    `,
    [jobId]
  );
  const conversionTask = conversionTaskQuery.rows[0];

  // create data source
  const { rows } = await client.query(
    `
      insert into data_sources (
        upload_task_id,
        project_id,
        type,
        bounds,
        url,
        import_type,
        bucket_id,
        object_key,
        byte_length,
        uploaded_source_filename,
        uploaded_source_layername,
        normalized_source_object_key,
        normalized_source_bytes,
        geostats,
        tile_size,
        attribution,
        original_source_url,
        was_converted_from_esri_feature_layer,
        uploaded_by,
        created_by,
        changelog
      ) values ($1, $2, $3, $4, $5, $6, (select url from data_sources_buckets where bucket = $7), $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19, $20)
      returning *
    `,
    [
      uploadTaskId,
      projectId,
      pmtiles
        ? isVector
          ? "seasketch-mvt"
          : "seasketch-raster"
        : "seasketch-vector",
      pmtiles ? null : layer.bounds,
      layer.url,
      "upload",
      bucketId,
      objectKey,
      original.size,
      layer.filename,
      layer.name,
      normalizedOutput.remote
        .replace("s3://", "")
        .split("/")
        .slice(1)
        .join("/"),
      original.size,
      layer.geostats === null
        ? null
        : "layers" in layer.geostats
        ? layer.geostats
        : isRasterInfo(layer.geostats)
        ? layer.geostats
        : // If geostats is just a fragment layer, put it into a complete
          // geostats layer list
          {
            layers: [layer.geostats],
            layerCount: 1,
          },
      pmtiles && !isVector ? 512 : null,
      conversionTask?.attribution || null,
      conversionTask?.location || null,
      Boolean(conversionTask),
      uploadedBy,
      changelog,
    ]
  );
  const dataSourceId = rows[0].id;
  const dataSourceBounds = rows[0].bounds;

  // Create data_upload_outputs for each output
  for (const output of layer.outputs) {
    await client.query(
      `
            insert into data_upload_outputs (
              data_source_id,
              type,
              remote,
              size,
              filename,
              url,
              is_original,
              project_id,
              original_filename
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
      [
        dataSourceId,
        output.type,
        output.remote,
        output.size,
        output.filename,
        output.url,
        Boolean(output.isOriginal),
        projectId,
        layer.filename,
      ]
    );
  }

  const sourceLayer = pmtiles ? layer.name : undefined;

  if (replace) {
    // create archived_data_sources record with the old data_source
    // first, get the related source, layer, and table of contents items
    const sourceResults = await client.query(
      `
          select * from data_sources where id = $1
        `,
      [replace.sourceId]
    );
    if (!sourceResults.rows.length) {
      throw new Error("Could not find source to replace");
    }
    const source = sourceResults.rows[0];
    const layerResults = await client.query(
      `
          select * from data_layers where id = $1
        `,
      [replace.layerId]
    );
    if (!layerResults.rows.length) {
      throw new Error("Could not find layer to replace");
    }
    if (layerResults.rows.length > 1) {
      throw new Error("Not implemented. Found multiple layers to replace");
    }
    const dataLayer = layerResults.rows[0];
    const tocResults = await client.query(
      `
          select * from table_of_contents_items where data_layer_id = $1
        `,
      [dataLayer.id]
    );
    if (!tocResults.rows.length) {
      throw new Error("Could not find table of contents item to replace");
    }
    if (tocResults.rows.length > 1) {
      throw new Error(
        "Not implemented. Found multiple table of contents items to replace"
      );
    }
    const tocItem = tocResults.rows[0];
    // attach the new data source to the existing layer
    // Do this as a single transaction using a stored procedure to avoid any
    // inconsistency in state
    await client.query(
      `
        select replace_data_source($1, $2, $3, $4, $5)
      `,
      [
        dataLayer.id,
        dataSourceId,
        sourceLayer,
        layer.bounds,
        // if the new data source is a conversion task, use the mapbox_gl_styles
        // from the conversion task (translated esri styles). Otherwise, if the
        // existing layer being replaced already has a style, leave it blank.
        // The replace_data_source stored procedure will fill it in with the
        // existing style when left null. Finally, for the case where the
        // existing style is blank (e.g. an arcgis layer is being replace by an upload),
        // generate a new style based on the geometry type.
        conversionTask
          ? JSON.stringify(conversionTask.mapbox_gl_styles)
          : dataLayer.mapbox_gl_styles
          ? null
          : JSON.stringify(
              await getStyle(
                isVector
                  ? (layer.geostats as GeostatsLayer)?.geometry || "Polygon"
                  : "Raster",
                uploadCount,
                layer.geostats
              )
            ),
      ]
    );

    // TODO: if it is a conversion task, update
    // metadata using the data on the conversion task
    if (conversionTask) {
      await client.query(
        `
          update table_of_contents_items set metadata = $1 where id = $2
        `,
        [conversionTask.metadata, tocItem.id]
      );
    }

    // return dataSourceId, dataLayerId, tableOfContentsItemId
    return {
      dataSourceId,
      dataLayerId: dataLayer.id,
      tableOfContentsItemId: tocItem.id,
    };
  } else {
    const layerResult = await client.query(
      `
        insert into data_layers (
          project_id,
          data_source_id,
          source_layer,
          mapbox_gl_styles
        ) values (
          $1, $2, $3, $4
        ) returning *
      `,
      [
        projectId,
        dataSourceId,
        pmtiles ? layer.name : undefined,
        JSON.stringify(
          conversionTask?.mapbox_gl_styles ||
            (await getStyle(
              isVector
                ? (layer.geostats as GeostatsLayer)?.geometry || "Polygon"
                : "Raster",
              uploadCount,
              layer.geostats
            ))
        ),
      ]
    );

    const dataLayerId = layerResult.rows[0].id;

    const tocResult = await client.query(
      `
        insert into table_of_contents_items (
          project_id,
          stable_id,
          title,
          is_folder,
          bounds,
          data_layer_id,
          sort_index,
          is_draft,
          metadata
        ) values (
          $1, $2, $3, $4, $5, $6, ((select count(*) from table_of_contents_items where project_id = $1 and is_draft = true)), $7, $8
        ) returning id
      `,
      [
        projectId,
        nanoId(),
        layer.name.replace("_", " "),
        false,
        layer.bounds,
        dataLayerId,
        // 0,
        true,
        JSON.stringify(
          conversionTask?.metadata || {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: {
                  level: 1,
                },
                content: [
                  {
                    type: "text",
                    text: layer.name,
                  },
                ],
              },
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `Uploaded ${new Date().toLocaleDateString()}`,
                  },
                ],
              },
            ],
          }
        ),
      ]
    );
    const tableOfContentsItemId = tocResult.rows[0].id;

    return {
      dataSourceId,
      dataLayerId,
      tableOfContentsItemId,
    };
  }
}

// Colors borrowed from https://github.com/mapbox/mbview/blob/master/views/vector.ejs#L75
var lightColors = [
  "#FC49A3", // pink
  "#CC66FF", // purple-ish
  "#1b14e3", // blue
  "#009463", // dark green
  "#0ac90a", // green
  "#FFCC66", // light orange
  "#FF6666", // salmon
  "#FF0000", // red
  "#FF8000", // orange
  "#dede00", // yellow
  "#00FFFF", // turquoise
];

function getColor(i: number) {
  if (i >= lightColors.length) {
    i = i - lightColors.length;
  }
  return lightColors[i % (lightColors.length - 1)];
}

async function getStyle(
  type: GeoJsonGeometryTypes | "Raster" | "Unknown",
  colorIndex: number,
  geostats?: GeostatsLayer | RasterInfo | null
) {
  if (type === "Unknown") {
    return [];
  }
  const color = getColor(colorIndex);
  let labelAttribute: string | undefined;
  if (geostats && "attributes" in geostats) {
    for (const attr of geostats.attributes) {
      if (
        attr.attribute !== "OBJECTID" &&
        attr.attribute !== "FEATURE_ID" &&
        attr.type === "string"
      ) {
        labelAttribute = attr.attribute;
        break;
      }
    }
  }
  switch (type) {
    case "Raster":
      if (!geostats || !isRasterInfo(geostats)) {
        return [
          {
            type: "raster",
            layout: {
              visibility: "visible",
            },
            paint: {
              "raster-resampling": "nearest",
            },
          },
        ];
      } else if (
        geostats.presentation === SuggestedRasterPresentation.categorical
      ) {
        let colors: [number, string][] = [];
        if (geostats.bands[0].colorTable) {
          colors = geostats.bands[0].colorTable;
        } else if (geostats.bands[0].stats.categories) {
          const categories = geostats.bands[0].stats.categories;
          for (const category of categories) {
            colors.push([
              category[0],
              colorScale.schemeTableau10[categories.indexOf(category) % 10],
            ]);
          }
        }
        return [
          {
            type: "raster",
            paint: {
              "raster-color": [
                "step",
                ["round", ["raster-value"]],
                "transparent",
                ...colors.flat(),
              ],
              "raster-color-mix": [0, 0, 258, geostats.bands[0].base],
              "raster-resampling": "nearest",
              "raster-color-range": [
                geostats.bands[0].minimum,
                geostats.bands[0].minimum + 255,
              ],
              "raster-fade-duration": 0,
            },
            layout: {
              visibility: "visible",
            },
            metadata: {
              "s:palette": "schemeTableau10",
            },
          },
        ];
      } else if (
        geostats.presentation === SuggestedRasterPresentation.continuous
      ) {
        const band = geostats.bands[0]!;
        let rasterColorMix = [
          ["*", 255, 65536],
          ["*", 255, 256],
          255,
          ["+", -32768, band.base],
        ] as any;
        if (band.interval && band.interval !== 1) {
          rasterColorMix = rasterColorMix.map((channel: any) => [
            "*",
            band.interval,
            channel,
          ]);
        }
        return [
          {
            type: "raster",
            paint: {
              "raster-color": [
                "interpolate",
                ["linear"],
                ["raster-value"],
                ...band.stats.equalInterval[9]
                  .map((bucket, i) => [bucket[0], plasma[i]])
                  .flat(),
              ],
              "raster-color-mix": rasterColorMix,
              "raster-resampling": "nearest",
              "raster-color-range": [band.minimum, band.maximum],
              "raster-fade-duration": 0,
            },
            layout: {
              visibility: "visible",
            },
            metadata: {
              "s:palette": "interpolatePlasma",
              ...(geostats.bands[0].offset || geostats.bands[0].scale
                ? { "s:respect-scale-and-offset": true }
                : {}),
            },
          },
        ];
      } else {
        return [
          {
            type: "raster",
            layout: {
              visibility: "visible",
            },
            paint: {
              "raster-resampling":
                geostats.presentation === SuggestedRasterPresentation.rgb
                  ? "linear"
                  : "nearest",
            },
          },
        ];
      }
    case "Polygon":
    case "MultiPolygon":
      return [
        {
          type: "fill",
          paint: {
            "fill-color": color,
            "fill-opacity": 0.5,
          },
        },
        {
          type: "line",
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
          },
          paint: {
            "line-color": autoStrokeColorForFillColor(color),
            "line-width": 1,
            "line-opacity": 1,
          },
          metadata: {
            "s:color-auto": true,
          },
        },
      ];
    case "LineString":
    case "MultiLineString":
      return [
        {
          type: "line",
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
          },
          paint: {
            "line-color": color,
            "line-width": 1,
            "line-opacity": 0.75,
          },
        },
      ];
    case "MultiPoint":
    case "Point":
      const circleLayer = {
        type: "circle",
        paint: {
          "circle-radius": 4,
          "circle-color": color,
          "circle-stroke-color": autoStrokeColorForFillColor(color),
          "circle-stroke-width": 2,
        },
        metadata: {
          "s:color-auto": true,
        },
      };
      if (labelAttribute) {
        return [
          circleLayer,
          {
            type: "symbol",
            paint: {
              "text-halo-color": "white",
              "text-halo-width": 1,
            },
            layout: {
              "text-size": 12,
              "text-field": ["get", labelAttribute],
              "text-anchor": "left",
              "symbol-placement": "point",
              "text-offset": [0.5, 0.5],
            },
            minzoom: 9,
          },
        ];
      } else {
        return [circleLayer];
      }
    default:
      return [
        {
          type: "fill",
          paint: {
            "fill-color": color,
            "fill-opacity": 0.2,
          },
        },
        {
          type: "line",
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: "visible",
          },
          paint: {
            "line-color": color,
            "line-width": 1,
            "line-opacity": 0.75,
          },
        },
      ];
  }
}

function colors(specifier: string) {
  var n = (specifier.length / 6) | 0,
    colors = new Array(n),
    i = 0;
  while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
  return colors;
}

const plasma = [
  "#0d0887",
  "#46039f",
  "#7201a8",
  "#9c179e",
  "#bd3786",
  "#d8576b",
  "#ed7953",
  "#fb9f3a",
  "#fdca26",
  "#f0f921",
];
const magma = [
  "#000004",
  "#180f3d",
  "#440f76",
  "#721f81",
  "#9e2f7f",
  "#cd4071",
  "#f1605d",
  "#fd9668",
  "#feca8d",
  "#fcfdbf",
];

export function autoStrokeColorForFillColor(fillColor: string) {
  const c = colord(fillColor);
  if (c.alpha() === 0) {
    return "#558";
  }
  if (c.isDark()) {
    return c.lighten(0.3).alpha(1).toRgbString();
  } else {
    return c.darken(0.15).alpha(1).toRgbString();
  }
}
