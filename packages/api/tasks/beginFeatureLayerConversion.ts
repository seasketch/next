import { Helpers } from "graphile-worker";
import { SpatialUploadsHandlerRequest } from "spatial-uploads-handler";
import AWS from "aws-sdk";
import { generateMetadataForLayer } from "../src/plugins/computedMetadataPlugin";
import {
  ImageList,
  styleForFeatureLayer,
  setCanvasPolyfill,
  setCanvasToDataURLPolyfill,
} from "@seasketch/mapbox-gl-esri-sources";
import { createHash } from "crypto";
import { v4 as uuid } from "uuid";
import * as S3 from "aws-sdk/clients/s3";
import * as PureImage from "pureimage";
import { PNG } from "pngjs";

setCanvasPolyfill((w, h) => {
  const canvas = PureImage.make(w, h);
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < canvas.width; i++) {
    for (let j = 0; j < canvas.height; j++) {
      canvas.setPixelRGBA(i, j, 0);
    }
  }
  return canvas as unknown as HTMLCanvasElement;
});

export const getByteBigEndian = function (
  uint32value: number,
  byteNo: 0 | 1 | 2 | 3
) {
  return (uint32value >>> (8 * (3 - byteNo))) & 0xff;
};

export const getBytesBigEndian = function (
  /** the source to be extracted */
  uint32value: number
) {
  return [
    getByteBigEndian(uint32value, 0),
    getByteBigEndian(uint32value, 1),
    getByteBigEndian(uint32value, 2),
    getByteBigEndian(uint32value, 3),
  ] as [number, number, number, number];
};

setCanvasToDataURLPolyfill((canvas) => {
  const bitmap = canvas as unknown as PureImage.Bitmap;
  const png = new PNG({
    width: bitmap.width,
    height: bitmap.height,
    deflateLevel: 9,
    deflateStrategy: 3,
  });
  for (let i = 0; i < bitmap.width; i++) {
    for (let j = 0; j < bitmap.height; j++) {
      const rgba = bitmap.getPixelRGBA(i, j);
      const n = (j * bitmap.width + i) * 4;
      const bytes = getBytesBigEndian(rgba);
      for (let k = 0; k < 4; k++) {
        png.data[n + k] = bytes[k];
      }
    }
  }
  const data = PNG.sync.write(png);
  const url = `data:image/png;base64,${data.toString("base64")}`;
  return url;
});

const s3 = new S3.default({
  region: process.env.S3_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export default async function beginFeatureLayerConversion(
  payload: { jobId: string },
  helpers: Helpers
) {
  const { jobId } = payload;
  helpers.logger.info(
    `Begining esri feature layer conversion to SeaSketch-hosted layer: ${jobId}`
  );
  await helpers.withPgClient(async (client) => {
    async function handleError(msg: string) {
      return client.query(
        `update project_background_jobs set state = 'failed', error_message = $2, progress_message = 'failed' where id = $1`,
        [jobId, msg]
      );
    }

    const results = await client.query(
      `update project_background_jobs set progress_message = 'preparing', state = 'running', started_at = now() where id = $1 returning *`,
      [jobId]
    );

    const job = results.rows[0];
    if (!job) {
      return handleError("Could not find job with ID=" + jobId);
    }

    const projectId = job.project_id;
    const slugResults = await client.query(
      `select slug from projects where id = $1`,
      [projectId]
    );

    const userResults = await client.query(
      `
      select 
        users.canonical_email, 
        user_profiles.fullname, 
        user_profiles.email 
      from 
        users 
      inner join user_profiles on 
        user_profiles.user_id = users.id 
      where users.id = $1
    `,
      [results.rows[0].user_id]
    );

    const slug = slugResults.rows[0].slug;
    const user: {
      canonical_email: string;
      fullname?: string | null;
      email?: string | null;
    } = userResults.rows[0];

    // First, get the related table of contents item
    let q = await client.query(
      `
      select
        table_of_contents_items.id,
        table_of_contents_items.data_layer_id,
        table_of_contents_items.data_source_type,
        table_of_contents_items.metadata,
        data_layers.mapbox_gl_styles
      from
        table_of_contents_items
      inner join
        data_layers
      on
        table_of_contents_items.data_layer_id = data_layers.id
      where
        table_of_contents_items.id = (
          select
            table_of_contents_item_id
          from
            esri_feature_layer_conversion_tasks
          where
            project_background_job_id = $1
        )
      `,
      [jobId]
    );
    if (q.rows.length === 0) {
      return handleError("Could not find related table of contents item");
    }
    const dataSourceType = q.rows[0].data_source_type;
    if (
      dataSourceType !== "arcgis-vector" &&
      dataSourceType !== "arcgis-dynamic-mapserver-vector-sublayer"
    ) {
      return handleError(`Unsupported data source type "${dataSourceType}"`);
    }

    const urlQuery = await client.query(
      `
      select
        data_sources.url,
        data_layers.sublayer,
        data_layers.data_source_id,
        data_sources.attribution
      from
        data_layers
      inner join
        data_sources
      on
        data_layers.data_source_id = data_sources.id
      where
        data_layers.id = $1
      `,
      [q.rows[0].data_layer_id]
    );

    if (urlQuery.rows.length === 0) {
      return handleError("Could not find data layer and source");
    }

    const { url, sublayer, data_source_id } = urlQuery.rows[0];

    const location =
      dataSourceType === "arcgis-dynamic-mapserver-vector-sublayer"
        ? `${url.replace(/\/$/, "")}/${sublayer}`
        : url;

    await client.query(
      `update 
        project_background_jobs 
      set progress_message = 'exporting' 
      where id = $1`,
      [jobId]
    );

    try {
      const request = await fetch(
        `https://arcgis-export.seasketch.org/?store=true&location=${location}`
      );

      const response = await request.json();
      const objectKey = response.key;

      if (!objectKey?.length) {
        handleError("Response from export service did not contain object key");
      }

      let metadata = urlQuery.rows[0].metadata;
      const metadataResponse = await fetch(
        `${url}${sublayer !== null ? `/${sublayer}` : ""}?f=json`
      );
      const layerMetadata = await metadataResponse.json();
      // create and save gl_style and metadata to
      // esri_feature_layer_conversion_tasks
      let attribution =
        (urlQuery.rows[0].attribution?.length
          ? urlQuery.rows[0].attribution
          : null) || layerMetadata.copyrightText?.length
          ? layerMetadata.copyrightText
          : null;
      if (!metadata) {
        const serviceMetadataResponse = await fetch(
          `${url.replace(/\d+[\/]*$/, "")}?f=json`
        );
        const serviceMetadata = await serviceMetadataResponse.json();
        metadata = generateMetadataForLayer(
          url,
          serviceMetadata,
          layerMetadata
        );
      }

      let glStyle = urlQuery.rows[0].mapbox_gl_styles;
      if (!glStyle || !Array.isArray(glStyle) || glStyle.length === 0) {
        // create sprites
        let styleInfo: {
          imageList: ImageList;
          layers: mapboxgl.Layer[];
        } | null = null;
        try {
          styleInfo = await styleForFeatureLayer(
            location.replace(/\/\d+$/, ""),
            parseInt(location.match(/\/(\d+)$/)?.[1] || "0"),
            // client is responsible for mapping source ids to layers at runtime
            "delete-me",
            layerMetadata
          );
        } catch (e: any) {
          console.error(e);
          return handleError(`Problem generating style. ${e.message}`);
        }
        if (!styleInfo) {
          return handleError("Problem generating style");
        }
        glStyle = styleInfo.layers.map((l) => {
          // @ts-ignore
          delete l.id;
          delete l.source;
          return l;
        });
        const sprites = await styleInfo.imageList.toJSON();
        for (const sprite of sprites) {
          // first, check if a sprite already exists in the db with this hash
          const smallestImage = sprite.images.sort(
            (a, b) => a.pixelRatio - b.pixelRatio
          )[0];
          const [preamble, data] = smallestImage.dataURI.split(",");
          const buffer = Buffer.from(data, "base64");
          const smallestHash = createHash("md5").setEncoding("hex");
          smallestHash.write(buffer);
          smallestHash.end();
          const spriteHash = smallestHash.read();
          // check if a sprite already exists in the db with this hash
          const existingQ = await client.query(
            `select * from sprites where md5 = $1 and project_id = $2 and deleted = false`,
            [spriteHash, projectId]
          );
          if (existingQ.rows.length > 0) {
            glStyle = replaceImageIds(
              glStyle,
              sprite.id,
              "seasketch://sprites/" + existingQ.rows[0].id
            );
          } else {
            // create a new sprite
            const r = await client.query(
              `
                insert into sprites (
                  project_id,
                  md5
                ) values ($1, $2) returning id
              `,
              [projectId, spriteHash]
            );
            const spriteRecord = r.rows[0];
            glStyle = replaceImageIds(
              glStyle,
              sprite.id,
              "seasketch://sprites/" + spriteRecord.id
            );
            for (const image of sprite.images) {
              const mimeType = preamble.split(":")[1].split(";")[0];
              let extension = "png";
              switch (mimeType) {
                case "image/jpeg":
                  extension = "jpg";
                  break;
                case "image/png":
                  extension = "png";
                  break;
                case "image/gif":
                  extension = "gif";
                  break;
                default:
                  throw new Error(`Unsupported image type ${mimeType}`);
              }
              // upload to s3, and create new sprite records in the db
              const filename = uuid() + "." + extension;
              await s3
                .putObject({
                  Bucket: process.env.PUBLIC_S3_BUCKET!,
                  Key: `sprites/${filename}`,
                  Body: buffer,
                  ContentType: mimeType,
                  CacheControl: "public, max-age=31536000",
                })
                .promise();
              await client.query(
                `
                  insert into sprite_images (
                    sprite_id,
                    pixel_ratio,
                    width,
                    height,
                    url
                  ) values ($1, $2, $3, $4, $5)
                `,
                [
                  spriteRecord.id,
                  image.pixelRatio,
                  image.width,
                  image.height,
                  `/sprites/${filename}`,
                ]
              );
            }
          }
        }
      }

      await client.query(
        `update 
          esri_feature_layer_conversion_tasks 
        set 
          metadata = $1,
          mapbox_gl_styles = $2,
          location = $3,
          attribution = $4
        where 
          project_background_job_id = $5`,
        [
          JSON.stringify(metadata),
          JSON.stringify(glStyle),
          location,
          attribution,
          jobId,
        ]
      );

      // Fire off request to lambda (or local http server if in development)
      try {
        await runLambda({
          taskId: jobId,
          objectKey,
          suffix: slug,
          requestingUser: user.fullname
            ? `${user.fullname} <${user.email || user.canonical_email}>`
            : user.email || user.canonical_email,
        });
      } catch (e) {
        console.error("Error calling runLambda", e);
        if (process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER) {
          await client.query(
            `update project_background_jobs set state = 'failed', error_message = $2, progress_message = 'failed' where id = $1`,
            [jobId, (e as Error).message]
          );
        } else {
          await client.query(
            `update project_background_tasks set state = 'failed', progress_message = 'failed', error_message = 'Lambda invocation failure' where id = $1`,
            [jobId]
          );
        }
      }
    } catch (e: any) {
      return handleError(e.message || "Unknown error");
    }
  });
}

const client = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 60000 * 5.5,
  },
});

async function runLambda(event: SpatialUploadsHandlerRequest) {
  if (process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER) {
    const response = await fetch(
      process.env.SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER,
      {
        method: "POST",
        body: JSON.stringify(event),
      }
    );
    const text = await response.text();
    if (text.length === 0) {
      throw new Error(
        "Lambda invocation failed. Could be due to attempting to run multiple simultaneous tasks with dev container."
      );
    }
    return JSON.parse(text);
  } else if (process.env.SPATIAL_UPLOADS_LAMBDA_ARN) {
    await client
      .invoke({
        InvocationType: "Event",
        FunctionName: process.env.SPATIAL_UPLOADS_LAMBDA_ARN,
        Payload: JSON.stringify({
          ...event,
          skipLoggingProgress:
            process.env.PGHOST && /rds.amazonaws.com/.test(process.env.PGHOST)
              ? false
              : true,
        }),
      })
      .promise();
  } else {
    throw new Error(
      `Neither SPATIAL_UPLOADS_LAMBDA_ARN or SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER are defined`
    );
  }
}

function replaceImageIds(glStyle: any, oldId: string, newId: string) {
  return glStyle.map((layer: any) => {
    const stringified = JSON.stringify(layer);
    if (stringified.includes(oldId)) {
      return JSON.parse(
        stringified.replace(new RegExp(oldId, "g"), newId.toString())
      );
    } else {
      return layer;
    }
  });
}
