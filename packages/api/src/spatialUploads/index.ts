import { Client, PoolClient } from "pg";
import { ProcessedUploadLayer } from "spatial-uploads-handler";
import { customAlphabet } from "nanoid";
import { GeoJsonGeometryTypes } from "geojson";
const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const nanoId = customAlphabet(alphabet, 9);

export async function createTableOfContentsItemForLayer(
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
  console.log("upload task ID", uploadTaskId);
  if (layer.outputs.find((output) => output.type === "FlatGeobuf")) {
    // vector
    const geojson = layer.outputs.find((output) => output.type === "GeoJSON");
    const fgb = layer.outputs.find((output) => output.type === "FlatGeobuf");
    if (!fgb) {
      throw new Error("FlatGeobuf not listed in outputs of vector source");
    }
    const pmtiles = layer.outputs.find((output) => output.type === "PMTiles");
    let bucketId: string | null = null;
    let objectKey: string | null = null;
    if (geojson) {
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
        geostats
      ) values ($1, $2, $3, $4, $5, $6, (select url from data_sources_buckets where bucket = $7), $8, $9, $10, $11, $12, $13, $14)
      returning *
    `,
      [
        uploadTaskId,
        projectId,
        pmtiles ? "seasketch-mvt" : "seasketch-vector",
        pmtiles ? null : layer.bounds,
        pmtiles?.url || null,
        "upload",
        bucketId,
        objectKey,
        fgb.size,
        layer.filename,
        layer.name,
        fgb.remote.replace("s3://", "").split("/").slice(1).join("/"),
        fgb.size,
        layer.geostats,
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
          getStyle(layer.geostats?.geometry || "Polygon", uploadCount)
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
        layer.name,
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
    return {
      dataSourceId,
      dataLayerId,
      tableOfContentsItemId,
    };
  } else {
    throw new Error("Not implemented");
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

function getStyle(type: GeoJsonGeometryTypes, colorIndex: number) {
  const color = getColor(colorIndex);
  switch (type) {
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
    case "Point":
      [
        {
          type: "circle",
          paint: {
            "circle-radius": 12,
            "circle-color": color,
          },
        },
      ];
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
