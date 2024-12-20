import { Feature, Polygon } from "geojson";
import { DBClient } from "../dbClient";
import { MapTileCacheCalculator } from "@seasketch/map-tile-cache-calculator/dist/bundled";
import { file } from "tmp-promise";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import bbox from "@turf/bbox";
import centerOfMass from "@turf/center-of-mass";
import { Google, googleToTile } from "global-mercator";
import fs from "fs";
import S3 from "aws-sdk/clients/s3";
import zlib from "zlib";
import Bottleneck from "bottleneck";

const s3 = new S3();

let calculator: MapTileCacheCalculator;

export async function createTilePackage(packageId: string, client: DBClient) {
  calculator =
    calculator ||
    new MapTileCacheCalculator("https://d3p1dsef9f0gjr.cloudfront.net/");

  if (!process.env.MAPBOX_ACCESS_TOKEN) {
    throw new Error("MAPBOX_ACCESS_TOKEN env var not set");
  }

  if (!process.env.TILE_PACKAGES_BUCKET) {
    throw new Error("TILE_PACKAGES_BUCKET env var not set");
  }

  const results: {
    id: string;
    projectId: number;
    dataSourceUrl: string;
    isMapboxHosted: string;
    status: string;
    region: string;
    maxZ: number;
    maxShorelineZ: number;
    accessToken?: string;
    sourceType: "raster" | "raster-dem" | "vector";
    originalUrlTemplate: string;
  }[] = (
    await client.query(
      `
      select
        offline_tile_packages.id,
        project_id as "projectId",
        data_source_url as "dataSourceUrl",
        is_mapbox_hosted as "isMapboxHosted",
        status,
        ST_AsGeoJSON(offline_tile_packages.region) as "region",
        max_z as "maxZ",
        max_shoreline_z as "maxShorelineZ",
        projects.mapbox_public_key as "accessToken",
        source_type as "sourceType",
        original_url_template as "originalUrlTemplate"
      from
        offline_tile_packages
      inner join
        projects
      on
        projects.id = offline_tile_packages.project_id
      where
        offline_tile_packages.id = $1 and status = $2
        `,
      [packageId, "QUEUED"]
    )
  ).rows;
  if (results.length === 1) {
    await client.query(
      `update offline_tile_packages set status = 'GENERATING' where id = $1`,
      [packageId]
    );
    const result = results[0];
    const region = JSON.parse(result.region);
    const totalTiles = await calculator.countChildTiles({
      levelOfDetail: 1,
      maxShorelineZ: result.maxShorelineZ,
      maxZ: result.maxZ,
      region,
    });
    if (totalTiles > 50000) {
      await client.query(
        `update offline_tile_packages set status = 'FAILED', total_tiles = $2, error = $3 where id = $1`,
        [packageId, totalTiles, "Total tiles must not exceed 50,000"]
      );
    } else {
      await client.query(
        `update offline_tile_packages set status = 'GENERATING', total_tiles = $2 where id = $1`,
        [packageId, totalTiles]
      );
      try {
        const { fd, path, cleanup } = await file({
          postfix: ".mbtiles",
        });
        const db = await open({
          filename: path,
          driver: sqlite3.Database,
        });

        // Metadata
        // https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md#metadata
        await db.run(`CREATE TABLE metadata (name text, value text);`);
        // MUST content
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "name",
          result.dataSourceUrl,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "format",
          result.sourceType === "vector" ? "pbf" : "webp",
        ]);
        // SHOULD content
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "bounds",
          bbox(region).join(","),
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "center",
          // Hard-coded zoom level of 3
          [...centerOfMass(region).geometry.coordinates, 3].join(","),
        ]);
        db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "minzoom",
          "0",
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "maxzoom",
          result.maxShorelineZ ? result.maxShorelineZ : result.maxZ,
        ]);

        // SeaSketch-specific metadata
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "maxZ",
          result.maxZ,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "maxShorelineZ",
          result.maxShorelineZ,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "dataSourceUrl",
          result.dataSourceUrl,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "projectId",
          result.projectId,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "createdAt",
          new Date().toISOString(),
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "uuid",
          result.id,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "sourceType",
          result.sourceType,
        ]);
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "originalUrlTemplate",
          result.originalUrlTemplate,
        ]);

        const parts = result.dataSourceUrl.replace(/\/$/, "").split("/");
        const sourcesList = parts[parts.length - 1];

        if (result.sourceType === "vector") {
          // Vector Tileset Metadata
          // https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md#vector-tileset-metadata
          if (!result.isMapboxHosted) {
            throw new Error(
              "Only mapbox-hosted sources are supported at this time"
            );
          }
          const url = `${baseUrlForMapBoxSource(sourcesList).replace(
            /\/$/,
            ""
          )}.json?access_token=${
            result.accessToken || process.env.MAPBOX_ACCESS_TOKEN
          }`;
          const response = await fetch(url);
          const json = await response.json();
          if (!("vector_layers" in json)) {
            throw new Error("Could not find vector_layers in response json");
          }
          await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
            "json",
            JSON.stringify({ vector_layers: json.vector_layers }),
          ]);
        }

        // Tiles
        // https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md#tiles
        await db.run(
          `CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);`
        );
        await db.run(
          `CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);`
        );
        if (!sourcesList.length) {
          throw new Error(`Sources list blank`);
        }
        let failuresWithoutSuccess = 0;
        let tilesProcessed = 0;

        async function addTile(tile: number[], totalTiles: number) {
          const url =
            result.sourceType === "vector"
              ? tileUrlForMapBoxVectorSource(
                  sourcesList,
                  tile,
                  result.accessToken || process.env.MAPBOX_ACCESS_TOKEN!
                )
              : result.sourceType === "raster"
              ? tileUrlForMapBoxRasterSource(
                  sourcesList,
                  tile,
                  result.accessToken || process.env.MAPBOX_ACCESS_TOKEN!
                )
              : tileUrlForMapBoxRasterDemSource(
                  sourcesList,
                  tile,
                  result.accessToken || process.env.MAPBOX_ACCESS_TOKEN!
                );
          try {
            const response = await fetchWithTimeout(url, 10000);
            if (response.ok) {
              failuresWithoutSuccess = 0;
              const bin = await response.arrayBuffer();
              await db.run(
                `INSERT into tiles (tile_column, tile_row, zoom_level, tile_data) values (?, ?, ?, ?)`,
                [...tile, new Uint8Array(bin)]
              );
            } else {
              if (response.status < 500) {
                failuresWithoutSuccess++;
                if (failuresWithoutSuccess > 4000) {
                  throw new Error(
                    `Failed to retrieve tiles ${failuresWithoutSuccess} times without any successes. Last message = ${await response.text()}. Last url = ${url}`
                  );
                }
              } else {
                throw new Error(
                  "Request for tile failed with status = " + response.status
                );
              }
            }
            tilesProcessed++;
            // only do this for every 20 tiles
            if (
              tilesProcessed === 1 ||
              tilesProcessed % 20 === 0 ||
              tilesProcessed === totalTiles
            ) {
              client.query(
                `update offline_tile_packages set tiles_fetched = $2 where id = $1`,
                [packageId, tilesProcessed]
              );
            }
          } catch (e: any) {
            if (/The user aborted a request/.test(e.toString())) {
              console.error(url);
              throw new Error("Repeated timeout while requesting a map tiles");
            } else {
              throw e;
            }
          }
        }

        const tiles: number[][] = [];
        await calculator.traverseOfflineTiles(
          {
            levelOfDetail: 1,
            maxShorelineZ: result.maxShorelineZ,
            maxZ: result.maxZ,
            region,
          },
          async (tile, stop) => {
            tiles.push(tile);
          }
        );

        // Mapbox Tiling API rate limit is 100,000 / minute
        // https://docs.mapbox.com/api/maps/vector-tiles/#vector-tiles-api-restrictions-and-limits
        // or, 1,666 / second
        const limiter = new Bottleneck({
          minTime: 20, // 1000 / 25 = 50 batches per second * 10 = 500 tiles / second
          maxConcurrent: 10,
        });

        limiter.on("failed", async (error, jobInfo) => {
          const id = jobInfo.options.id;
          console.warn(`Map tile fetch ${id} failed: ${error}`);
          if (jobInfo.retryCount === 0) {
            // Here we only retry once
            return 25;
          } else {
            try {
              // For unrecoverable errors, kill the tiling process and update the
              // db record. Note that 404's should *not* trigger this
              await client.query(
                `update offline_tile_packages set status = 'FAILED', error = $2 where id = $1`,
                [packageId, error.toString()]
              );
              await limiter.stop();
            } catch (e) {
              console.error(e);
            }
          }
        });

        const curried = (tile: number[]) => addTile(tile, tiles.length);

        const status = await Promise.all(
          tiles.map((tile) => limiter.schedule(curried, tile))
        );

        await db.close();
        const stats = fs.statSync(path);
        await client.query(
          `update offline_tile_packages set status = 'UPLOADING', bytes = $2, tiles_fetched = $3 where id = $1`,
          [packageId, stats.size, tilesProcessed++]
        );
        const location = await uploadMBTiles(path, result.id);
        await client.query(
          `update offline_tile_packages set status = 'COMPLETE' where id = $1`,
          [packageId]
        );
        // Delete older tile packages with the same project_id and data_source_url
        await client.query(
          `delete from offline_tile_packages where data_source_url = $1 and project_id = $2 and id != $3`,
          [result.dataSourceUrl, result.projectId, result.id]
        );
        cleanup();
      } catch (e: any) {
        await client.query(
          `update offline_tile_packages set status = 'FAILED', error = $2 where id = $1`,
          [packageId, e.toString()]
        );
        throw e;
      }
    }
  } else {
    throw new Error(
      `Could not find offline_tile_package with id = ${packageId}`
    );
  }
}

export function baseUrlForMapBoxSource(sourcesList: string) {
  return `https://api.mapbox.com/v4/${sourcesList}`;
}

export function tileUrlForMapBoxVectorSource(
  sourcesList: string,
  tile: number[],
  accessToken: string
) {
  return `https://api.mapbox.com/v4/${sourcesList}/${tile[Z]}/${tile[X]}/${tile[Y]}.vector.pbf?access_token=${accessToken}`;
}

export function tileUrlForMapBoxRasterSource(
  sourcesList: string,
  tile: number[],
  accessToken: string
) {
  return `https://api.mapbox.com/v4/${sourcesList}/${tile[Z]}/${tile[X]}/${tile[Y]}@2x.webp?access_token=${accessToken}`;
}

export function tileUrlForMapBoxRasterDemSource(
  sourcesList: string,
  tile: number[],
  accessToken: string
) {
  return `https://api.mapbox.com/v4/${sourcesList}/${tile[Z]}/${tile[X]}/${tile[Y]}.webp?access_token=${accessToken}`;
}

export function objectKeyForTilePackageId(id: string) {
  return `${id}.mbtiles`;
}

async function uploadMBTiles(path: string, id: string) {
  return new Promise<string>(async (resolve, reject) => {
    var read = fs.createReadStream(path);
    var compress = zlib.createGzip();
    var response = await s3
      .upload({
        Bucket: process.env.TILE_PACKAGES_BUCKET!,
        Key: objectKeyForTilePackageId(id),
        Body: read.pipe(compress),
        ContentType: "application/vnd.mapbox-vector-tile",
        ContentEncoding: "gzip",
        CacheControl: "max-age=31536000",
      })
      .promise();
    resolve(response.Location);
  });
}

const X = 0;
const Y = 1;
const Z = 2;

async function fetchWithTimeout(url: string, ms = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, ms);

  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  return response;
}
