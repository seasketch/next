import { createServer } from "http";
import { createHash } from "crypto";
import { stops, zoomToH3Resolution } from "./stops";
import * as h3 from "h3-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { timing, setMetric, startTime, endTime } from "hono/timing";
import type { TimingVariables } from "hono/timing";

const tilebelt = require("@mapbox/tilebelt");
const duckdb = require("duckdb");
const vtpbf = require("vt-pbf");
const Protobuf = require("pbf");
const geojsonVt = require("geojson-vt");

const emptyTileBuffer = createEmptyTileBuffer();

const db = new duckdb.Database("./output/crdss.duckdb");
const connection = db.connect();
connection.all("load h3", (err: any, data: any) => {
  if (err) {
    console.error(err);
  } else {
    console.log("h3 loaded", data);
    connection.all("load spatial", (err: any, data: any) => {
      if (err) {
        console.error(err);
      } else {
        console.log("spatial loaded", data);
      }
    });
  }
});

const attributeData = require("../output/attributes.json");

const app = new Hono();

app.use(timing());
app.use(logger());

app.use("/*", cors());

app.get("/mvt/:z/:x/:y", async (c, next) => {
  const z = parseInt(c.req.param("z"));
  const x = parseInt(c.req.param("x"));
  const y = parseInt(c.req.param("y"));
  const format = c.req.query("format") || "pbf";
  console.log(`Request for tile ${z}/${x}/${y}?format=${format}`);
  const resolution = Math.min(9, zoomToH3Resolution(z, stops));
  const query = `
    with ids as (
    select
      id,
    from
      geohashes
    where
      resolution = ? and
      geohash like ?
    )
    select
      h3_h3_to_string(id) as id,
    from ids
  `;
  const values = [resolution, `${tilebelt.tileToQuadkey([x, y, z])}%`];
  console.log(query, values);
  startTime(c, "db");
  const result = await all<{ id: string }>(query, values);
  endTime(c, "db");
  console.log(result.length);
  if (result.length === 0) {
    if (format === "geojson") {
      return c.json({
        type: "FeatureCollection",
        features: [],
      });
    } else {
      c.header("Content-Type", "application/x-protobuf");
      // return c.body(new Protobuf().finish());
      return c.body(emptyTileBuffer);
    }
  }
  const fc = {
    type: "FeatureCollection",
    features: result.map((row) => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: h3.cellsToMultiPolygon([row.id], true)[0],
      },
    })),
  };
  startTime(c, "pbf");
  const tileindex = geojsonVt(fc);
  const tile = tileindex.getTile(z, x, y);
  var buff = vtpbf.fromGeojsonVt({ cells: tile });
  console.log(buff.length);
  endTime(c, "pbf");
  if (format === "geojson") {
    return c.json(fc);
  } else {
    c.header("Content-Type", "application/x-protobuf");
    return c.body(buff);
  }
});

app.get("/attributes", async (c) => {
  return c.json(attributeData);
});

app.get("/filter", async (c) => {
  const filters = parseFilters(c.req.query("filter"));
  const rootTile = c.req.query("tile");
  if (!filters) {
    c.status(400);
    return c.text("Filter is required");
  }
  const f = buildWhereClauses(filters || {}, 1);
  if (f.where.length === 0 || f.values.length === 0) {
    c.status(400);
    return c.text("Filter is required");
  }
  const rootTileResolution = rootTile ? h3.getResolution(rootTile) : 0;
  let maxResolution = 8;
  if (rootTileResolution >= 6) {
    maxResolution = 11;
  } else if (rootTileResolution >= 5) {
    maxResolution = 10;
  }
  let query = `
        with filtered as (
          select
            distinct(r${maxResolution}_id) as id
          from
            cells
          where
            ${f.values.length > 0 ? f.where : "true"}
            ${
              rootTile
                ? `AND r${h3.getResolution(rootTile)}_id = h3_string_to_h3($${
                    f.values.length + 1
                  }::varchar)::uint64`
                : ""
            }
        )
      `;
  let currentResolution = maxResolution;
  let compacted: string[] = [];
  while (currentResolution >= 6) {
    compacted.push(`
            h3_compact_cells(
              ARRAY_AGG(
                distinct(
                  h3_cell_to_parent(h3_h3_to_string(id), ${currentResolution})
                )
              )
            ) as r${currentResolution}
        `);
    currentResolution--;
  }
  query += `
        select
        ${compacted.join(",\n")}
        from filtered
      `;

  const values = rootTile ? [...f.values, rootTile] : [...f.values];
  db.all(query, ...values, async (err: any, data: any) => {
    if (err) {
      console.error(err);
      c.status(500);
      return c.text("Error querying database");
    }
    const count = (
      await get<{ count: number }>(
        `Select count(id)::int as count from cells where ${f.where}`,
        f.values
      )
    ).count;
    type CellsByResolution = {
      [resolution: number]: string[];
    };
    const layers: {
      [displayResolution: number]: CellsByResolution;
    } = {};
    for (const key in data[0]) {
      const cells = data[0][key] || [];
      const displayResolution = Number(key.replace("r", ""));
      layers[displayResolution] = {} as CellsByResolution;
      for (const cell of cells) {
        const resolution = h3.getResolution(cell);
        if (!layers[displayResolution][resolution]) {
          layers[displayResolution][resolution] = [];
        }
        layers[displayResolution][resolution].push(cell);
      }
    }
    for (const displayResolution in layers) {
      console.log(`Resolution ${displayResolution}`);
      // print cell counts for each resolution
      const cells = layers[displayResolution];
      let total = 0;
      for (const r in cells) {
        console.log(`  ${r}: ${cells[r].length.toLocaleString()} cells`);
        total += cells[r].length;
      }
      console.log(`  Total: ${total.toLocaleString()} cells`);
    }
    c.header("Cache-Control", "public, max-age=30");
    console.timeEnd("filter request " + rootTile);
    return c.json({ count, layers });
  });
});

app.onError((err, c) => {
  console.error(`${err}`);
  return c.text("Custom Error Message", 500);
});

serve({
  fetch: app.fetch,
  port: 3003,
});

// create a nodejs http server
// createServer(async (req, res) => {
//   try {
//     const parsedUrl = new URL(req.url || "", `http://${req.headers.host}`);

//     const path = parsedUrl.pathname;
//     // Path begins with /mvt if it's a request for a Mapbox Vector Tile
//     const isMVTRequest = path.startsWith("/mvt");
//     if (isMVTRequest) {
//       if (req.method === "GET") {
//         console.time("mvt request " + path);
//         // Get tile coordinates from url (e.g. /mvt/8/1/2)
//         // verify that the path is in the format /mvt/{z}/{x}/{y}
//         const parts = path.split("/");
//         if (parts.length !== 5) {
//           res.statusCode = 400;
//           res.setHeader("Access-Control-Allow-Origin", "*");
//           res.end("Invalid URL");
//           return;
//         }
//         const [z, x, y] = parts.slice(2).map(Number);
//         const resolution = zoomToH3Resolution(z, stops);
//         console.log(`Request for tile ${z}/${x}/${y}`);
//         const bbox = tilebelt.tileToBBOX([x, y, z]);
//         console.log("BBOX", bbox);
//         const query = `
//           with ids as (
//           select
//             distinct(r${resolution}_id) as id,
//           from
//             cells
//           where
//             st_within(geom, ST_MakeEnvelope($1, $2, $3, $4))
//           )
//           select
//             h3_h3_to_string(id) as id,
//           from ids
//         `;
//         console.log(query, bbox);
//         const result = await all<{ id: string }>(query, bbox);
//         console.log(result.length);
//         // res.statusCode = 500;
//         console.timeEnd("mvt request " + path);
//         res.statusCode = 200;
//         res.setHeader("Access-Control-Allow-Origin", "*");
//         res.setHeader("Content-Type", "application/json");
//         res.end(
//           JSON.stringify({
//             type: "FeatureCollection",
//             features: result.map((row) => ({
//               type: "Feature",
//               properties: {},
//               geometry: {
//                 type: "Polygon",
//                 coordinates: h3.cellsToMultiPolygon([row.id], true)[0],
//               },
//             })),
//           })
//         );
//         // res.end(JSON.stringify(result));
//         // res.end("Not implemented");
//       } else {
//         console.timeEnd("mvt request " + path);
//         res.statusCode = 405;
//         res.setHeader("Access-Control-Allow-Origin", "*");
//         res.end("Method Not Allowed");
//       }
//     } else if (req.method === "GET" && path === "/filter") {
//       console.time("filter request " + parsedUrl.searchParams.get("tile"));
//       let filters: { [column: string]: Filter } | null = null;
//       if (parsedUrl.searchParams.has("filter")) {
//         const filter = JSON.parse(
//           decodeURIComponent(parsedUrl.searchParams.get("filter")!)
//         );
//         if (typeof filter === "object") {
//           filters = filter;
//         }
//       }
//       if (!filters) {
//         res.statusCode = 400;
//         res.setHeader("Access-Control-Allow-Origin", "*");
//         res.end("Filter is required");
//       }
//       const rootTile = parsedUrl.searchParams.get("tile");
//       const f = buildWhereClauses(filters || {}, 1);
//       if (f.where.length === 0 || f.values.length === 0) {
//         res.statusCode = 400;
//         res.setHeader("Access-Control-Allow-Origin", "*");
//         res.end("Filter is required");
//         return;
//       }
//       const rootTileResolution = rootTile ? h3.getResolution(rootTile) : 0;
//       let maxResolution = 8;
//       if (rootTileResolution >= 6) {
//         maxResolution = 11;
//       } else if (rootTileResolution >= 5) {
//         maxResolution = 10;
//       }
//       let query = `
//         with filtered as (
//           select
//             distinct(r${maxResolution}_id) as id
//           from
//             cells
//           where
//             ${f.values.length > 0 ? f.where : "true"}
//             ${
//               rootTile
//                 ? `AND r${h3.getResolution(rootTile)}_id = h3_string_to_h3($${
//                     f.values.length + 1
//                   }::varchar)::uint64`
//                 : ""
//             }
//         )
//       `;
//       let currentResolution = maxResolution;
//       let compacted: string[] = [];
//       while (currentResolution >= 6) {
//         compacted.push(`
//             h3_compact_cells(
//               ARRAY_AGG(
//                 distinct(
//                   h3_cell_to_parent(h3_h3_to_string(id), ${currentResolution})
//                 )
//               )
//             ) as r${currentResolution}
//         `);
//         currentResolution--;
//       }
//       query += `
//         select
//         ${compacted.join(",\n")}
//         from filtered
//       `;

//       const values = rootTile ? [...f.values, rootTile] : [...f.values];
//       db.all(query, ...values, async (err: any, data: any) => {
//         if (err) {
//           console.error(err);
//           res.statusCode = 500;
//           res.setHeader("Access-Control-Allow-Origin", "*");
//           res.end("Error querying database");
//           return;
//         }
//         const count = (
//           await get<{ count: number }>(
//             `Select count(id)::int as count from cells where ${f.where}`,
//             f.values
//           )
//         ).count;
//         type CellsByResolution = {
//           [resolution: number]: string[];
//         };
//         const layers: {
//           [displayResolution: number]: CellsByResolution;
//         } = {};
//         for (const key in data[0]) {
//           const cells = data[0][key] || [];
//           const displayResolution = Number(key.replace("r", ""));
//           layers[displayResolution] = {} as CellsByResolution;
//           for (const cell of cells) {
//             const resolution = h3.getResolution(cell);
//             if (!layers[displayResolution][resolution]) {
//               layers[displayResolution][resolution] = [];
//             }
//             layers[displayResolution][resolution].push(cell);
//           }
//         }
//         for (const displayResolution in layers) {
//           console.log(`Resolution ${displayResolution}`);
//           // print cell counts for each resolution
//           const cells = layers[displayResolution];
//           let total = 0;
//           for (const r in cells) {
//             console.log(`  ${r}: ${cells[r].length.toLocaleString()} cells`);
//             total += cells[r].length;
//           }
//           console.log(`  Total: ${total.toLocaleString()} cells`);
//         }
//         res.setHeader("Access-Control-Allow-Origin", "*");
//         res.setHeader("Content-Type", "application/json");
//         res.setHeader("Cache-Control", "public, max-age=600");
//         console.timeEnd("filter request " + parsedUrl.searchParams.get("tile"));
//         res.end(JSON.stringify({ count, layers }));
//       });
//     } else if (req.method === "GET" && path === "/attributes") {
//       res.setHeader("Access-Control-Allow-Origin", "*");
//       res.setHeader("Content-Type", "application/json");
//       res.setHeader("Cache-Control", "public, max-age=3600");
//       res.end(JSON.stringify(attributeData));
//     } else {
//       res.statusCode = 404;
//       res.setHeader("Access-Control-Allow-Origin", "*");
//       res.end("Not found");
//     }
//   } catch (e) {
//     console.error(e);
//     res.statusCode = 400;
//     res.setHeader("Access-Control-Allow-Origin", "*");
//     res.end("Invalid URL");
//   }
// }).listen(3003, () => {
//   console.log("Server is running on http://localhost:3003");
// });

type NumberFilter = {
  min?: number;
  max?: number;
};

type BooleanFilter = {
  bool: boolean;
};

type StringFilter = {
  choices: string[];
};

type Filter = NumberFilter | BooleanFilter | StringFilter;

function isNumberFilter(filter: Filter): filter is NumberFilter {
  return (
    (filter as NumberFilter).min !== undefined ||
    (filter as NumberFilter).max !== undefined
  );
}

function isBooleanFilter(filter: Filter): filter is BooleanFilter {
  return (filter as BooleanFilter).bool !== undefined;
}

function isStringFilter(filter: Filter): filter is StringFilter {
  return (filter as StringFilter).choices !== undefined;
}

function buildWhereClauses(
  filters: { [column: string]: Filter },
  valueStartIndex = 4
): { where: string; values: any[] } {
  const whereClauses: string[] = [];
  const values: any[] = [];
  for (const [column, filter] of Object.entries(filters)) {
    if (isNumberFilter(filter)) {
      if ("min" in filter && "max" in filter) {
        whereClauses.push(
          `${column} >= $${valueStartIndex} AND ${column} <= $${
            valueStartIndex + 1
          }`
        );
        values.push(filter.min, filter.max);
        valueStartIndex += 2;
      } else if ("min" in filter) {
        whereClauses.push(`${column} >= $${valueStartIndex}`);
        values.push(filter.min);
        valueStartIndex++;
      } else if ("max" in filter) {
        whereClauses.push(`${column} <= $${valueStartIndex}`);
        values.push(filter.max);
        valueStartIndex++;
      }
    } else if (isBooleanFilter(filter)) {
      whereClauses.push(`${column} = $${valueStartIndex}`);
      values.push(filter.bool);
      valueStartIndex++;
    } else if (isStringFilter(filter) && filter.choices.length > 0) {
      whereClauses.push(
        `${column} IN (${filter.choices
          .map((_, i) => `$${valueStartIndex + i}`)
          .join(", ")})`
      );
      values.push(...filter.choices);
      valueStartIndex += filter.choices.length;
    } else {
      console.error("Invalid filter", filter);
    }
  }
  console.log("where", whereClauses);
  if (whereClauses.length === 0) {
    return { where: "", values: [] };
  } else {
    return { where: whereClauses.join(" AND "), values };
  }
}

function get<T>(query: string, values: any[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    connection.all(query, ...values, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else if (data && data.length > 0) {
        resolve(data[0] as T);
      } else {
        reject(new Error("No data returned from query"));
      }
    });
  });
}

function all<T>(query: string, values: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    connection.all(query, ...values, (err: any, data: any) => {
      if (err) {
        reject(err);
      } else if (data) {
        resolve(data as T[]);
      } else {
        reject(new Error("No data returned from query"));
      }
    });
  });
}

function parseFilters(filters?: string): { [column: string]: Filter } | null {
  if (!filters) {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(filters));
    if (typeof parsed === "object") {
      return parsed;
    } else {
      return null;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

function createEmptyTileBuffer() {
  const index = geojsonVt({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-81.9336880175533, 24.532357165118],
              [-81.9377015564132, 24.5349778311727],
              [-81.9420523013835, 24.532796637661],
              [-81.9423890725121, 24.5279947373529],
              [-81.938375407226, 24.5253743322599],
              [-81.9340250972132, 24.5275555665127],
              [-81.9336880175533, 24.532357165118],
            ],
          ],
        },
      },
    ],
  });
  const tile = index.getTile(0, 0, 0);
  tile.features = [];
  tile.numPoints = 0;
  tile.numFeatures = 0;
  tile.source = [];
  const buffer = vtpbf.fromGeojsonVt({ cells: tile });
  return buffer;
}

export default app;
