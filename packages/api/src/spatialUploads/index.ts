import { Client, PoolClient } from "pg";
import { ProcessedUploadLayer } from "spatial-uploads-handler";
import { customAlphabet } from "nanoid";
import { GeoJsonGeometryTypes } from "geojson";
import { GeostatsLayer } from "spatial-uploads-handler/src/geostats";
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
export async function createDBRecordsForProcessedUpload(
  layer: ProcessedUploadLayer,
  projectId: number,
  client: PoolClient | Client,
  uploadTaskId: string
) {
  const uploadCountResult = await client.query(
    `select count(*) as count from data_upload_tasks where project_id = $1`,
    [projectId]
  );
  let uploadCount = uploadCountResult.rows[0].count;
  const isVector = layer.outputs.find((o) => o.type === "FlatGeobuf");
  const normalizedOutput = layer.outputs.find((o) => o.isNormalizedOutput);
  const geojson = layer.outputs.find((output) => output.type === "GeoJSON");
  const fgb = layer.outputs.find((output) => output.type === "FlatGeobuf");
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
        tile_size
      ) values ($1, $2, $3, $4, $5, $6, (select url from data_sources_buckets where bucket = $7), $8, $9, $10, $11, $12, $13, $14, $15)
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
      layer.geostats,
      pmtiles && !isVector ? 512 : null,
    ]
  );
  const dataSourceId = rows[0].id;
  const color = getColor(uploadCount);
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
        getStyle(
          isVector ? layer.geostats?.geometry || "Polygon" : "Raster",
          uploadCount,
          layer.geostats
        )
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
      JSON.stringify({
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
      }),
    ]
  );
  const tableOfContentsItemId = tocResult.rows[0].id;

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
          project_id
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ]
    );
  }

  return {
    dataSourceId,
    dataLayerId,
    tableOfContentsItemId,
  };
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

function getStyle(
  type: GeoJsonGeometryTypes | "Raster",
  colorIndex: number,
  geostats?: GeostatsLayer | null
) {
  const color = getColor(colorIndex);
  let labelAttribute: string | undefined;
  if (geostats) {
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
    case "Polygon":
    case "MultiPolygon":
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
          "circle-radius": 5,
          "circle-color": color,
          "circle-stroke-color": "#000000",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0.5,
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
              "text-field": ["get", "FEATURE_NA"],
              "text-anchor": "left",
              "symbol-placement": "point",
              "text-offset": [0.5, 0.5],
            },
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
