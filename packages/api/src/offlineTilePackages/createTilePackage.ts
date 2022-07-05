import { Feature, Polygon } from "geojson";
import { DBClient } from "../dbClient";
import { MapTileCacheCalculator } from "@seasketch/map-tile-cache-calculator/dist/bundled";
import { file } from "tmp-promise";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import "../fetch-polyfill";
import bbox from "@turf/bbox";
import centerOfMass from "@turf/center-of-mass";
import { Google, googleToTile } from "global-mercator";
import fs from "fs";
import S3 from "aws-sdk/clients/s3";
import zlib from "zlib";
const s3Stream = require("s3-upload-stream")(new S3());

const calculator = new MapTileCacheCalculator(
  "https://d3p1dsef9f0gjr.cloudfront.net/"
);

if (!process.env.MAPBOX_ACCESS_TOKEN) {
  throw new Error("MAPBOX_ACCESS_TOKEN env var not set");
}

if (!process.env.TILE_PACKAGES_BUCKET) {
  throw new Error("TILE_PACKAGES_BUCKET env var not set");
}

const s3 = new S3();

export async function createTilePackage(packageId: string, client: DBClient) {
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
        projects.mapbox_public_key as "accessToken"
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
          keep: true,
        });
        console.log(path);
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
          "pbf",
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

        // Tileset Metadata
        // https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md#vector-tileset-metadata
        if (!result.isMapboxHosted) {
          throw new Error(
            "Only mapbox-hosted sources are supported at this time"
          );
        }
        const parts = result.dataSourceUrl.replace(/\/$/, "").split("/");
        const sourcesList = parts[parts.length - 1];
        const response = await fetch(
          `${result.dataSourceUrl.replace(/\/$/, "")}.json?access_token=${
            result.accessToken || process.env.MAPBOX_ACCESS_TOKEN
          }`
        );
        const json = await response.json();
        if (!("vector_layers" in json)) {
          throw new Error("Could not find vector_layers in response json");
        }
        await db.run(`INSERT INTO metadata (name, value) VALUES (?, ?)`, [
          "json",
          JSON.stringify({ vector_layers: json.vector_layers }),
        ]);

        // Tiles
        // https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md#tiles
        await db.run(
          `CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);`
        );
        await db.run(
          `CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);`
        );
        console.log("sources list", sourcesList);
        if (!sourcesList.length) {
          throw new Error(`Sources list blank`);
        }
        let failuresWithoutSuccess = 0;
        let tilesProcessed = 0;
        await calculator.traverseOfflineTiles(
          {
            levelOfDetail: 1,
            maxShorelineZ: result.maxShorelineZ,
            maxZ: result.maxZ,
            region,
          },
          async (tile, stop) => {
            const url = tileUrlForMapBoxVectorSource(
              sourcesList,
              tile,
              result.accessToken || process.env.MAPBOX_ACCESS_TOKEN!
            );
            const response = await fetch(url);
            client.query(
              `update offline_tile_packages set tiles_fetched = $2 where id = $1`,
              [packageId, tilesProcessed++]
            );
            if (response.ok) {
              failuresWithoutSuccess = 0;
              const bin = await response.arrayBuffer();
              await db.run(
                `INSERT into tiles (tile_column, tile_row, zoom_level, tile_data) values (?, ?, ?, ?)`,
                [...googleToTile(tile as Google), new Uint8Array(bin)]
              );
            } else {
              failuresWithoutSuccess++;
              if (failuresWithoutSuccess > 20) {
                stop();
                throw new Error(
                  `Failed to retrieve tiles ${failuresWithoutSuccess} times without any successes. Last message = ${await response.text()}`
                );
              }
            }
          }
        );
        await db.close();
        const stats = fs.statSync(path);
        await client.query(
          `update offline_tile_packages set status = 'UPLOADING', bytes = $2, tiles_fetched = $3 where id = $1`,
          [packageId, stats.size, tilesProcessed++]
        );
        const { location } = await uploadMBTiles(path, result.id);
        console.log(location);
        await client.query(
          `update offline_tile_packages set status = 'COMPLETE' where id = $1`,
          [packageId]
        );
        // await cleanup();
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

function tileUrlForMapBoxVectorSource(
  sourcesList: string,
  tile: number[],
  accessToken: string
) {
  return `https://api.mapbox.com/v4/${sourcesList}/${tile[Z]}/${tile[X]}/${tile[Y]}.vector.pbf?access_token=${accessToken}`;
}

export function objectKeyForTilePackageId(id: string) {
  return `${id}.mbtiles`;
}

async function uploadMBTiles(path: string, id: string) {
  return new Promise<{
    location: string;
    Bucket: string;
    Key: string;
    ETag: string;
  }>((resolve, reject) => {
    var read = fs.createReadStream(path);
    // var compress = zlib.createGzip();
    var upload = s3Stream.upload({
      Bucket: process.env.TILE_PACKAGES_BUCKET,
      Key: objectKeyForTilePackageId(id),
    });

    // Optional configuration
    upload.maxPartSize(20971520); // 20 MB
    upload.concurrentParts(5);

    // Handle errors.
    upload.on("error", function (error: Error) {
      reject(error);
    });

    //     /* Handle progress. Example details object:
    //    { ETag: '"f9ef956c83756a80ad62f54ae5e7d34b"',
    //      PartNumber: 5,
    //      receivedSize: 29671068,
    //      uploadedSize: 29671068 }
    // */
    //     upload.on("part", function (details) {
    //       console.log(details);
    //     });
    // TODO: Add upload progress
    /* Handle upload completion. Example details object:
   { Location: 'https://bucketName.s3.amazonaws.com/filename.ext',
     Bucket: 'bucketName',
     Key: 'filename.ext',
     ETag: '"bf2acbedf84207d696c8da7dbb205b9f-5"' }
*/
    upload.on(
      "uploaded",
      function (details: {
        location: string;
        Bucket: string;
        Key: string;
        ETag: string;
      }) {
        resolve(details);
      }
    );

    // Pipe the incoming filestream through compression, and up to S3.
    read.pipe(upload);
  });
}

const X = 0;
const Y = 1;
const Z = 2;
