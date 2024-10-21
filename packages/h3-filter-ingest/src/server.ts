import { Pool } from "pg";
import { createServer } from "http";
import { createHash } from "crypto";
import { stops, zoomToH3Resolution } from "./stops";
import * as h3 from "h3-js";
const duckdb = require("duckdb");

const db = new duckdb.Database("./output/crdss.duckdb");
const connection = db.connect();
connection.all("load h3", (err: any, data: any) => {
  if (err) {
    console.error(err);
  } else {
    console.log("h3 loaded", data);
  }
});

const attributeData = require("../output/attributes.json");

const pool = new Pool({
  database: "crdss",
  max: 50,
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// create a nodejs http server
const server = createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url || "", `http://${req.headers.host}`);

    const path = parsedUrl.pathname;
    // res.end("Hello World");
    const tileRegex = /^\/tiles\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/;
    const match = path.match(tileRegex);
    if (match && req.method === "GET") {
      const z = Number(match[1]);
      const x = Number(match[2]);
      const y = Number(match[3]);
      const ext = match[4];
      let filters: { [column: string]: Filter } | null = null;
      if (parsedUrl.searchParams.has("filter")) {
        const filter = JSON.parse(
          decodeURIComponent(parsedUrl.searchParams.get("filter")!)
        );
        if (typeof filter === "object") {
          filters = filter;
        }
      }
      console.time(`${z}/${x}/${y}.${ext}`);
      if (ext === "txt") {
        try {
          const data = await getText(z, x, y, filters || {});
          console.timeEnd(`${z}/${x}/${y}.${ext}`);
          // add cors headers to allow all origins
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "text/plain");
          // set cache headers
          res.setHeader("Cache-Control", "public, max-age=60");
          res.end(data);
        } catch (error) {
          console.error("Error querying database", error);
          res.statusCode = 500;
          res.end("Error querying database");
        }
      } else {
        res.statusCode = 404;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end("Not found");
      }
      // } else if (ext === "json") {
      // } else {
      //   try {
      //     const data = await getMVT(z, x, y, filters || {});
      //     console.timeEnd(`${z}/${x}/${y}.${ext}`);
      //     // add cors headers to allow all origins
      //     res.setHeader("Access-Control-Allow-Origin", "*");
      //     // add cache headers
      //     res.setHeader("Cache-Control", "public, max-age=60");
      //     res.setHeader("Content-Type", "application/vnd.mapbox-vector-tile");
      //     res.end(data);
      //   } catch (error) {
      //     console.error("Error querying database", error);
      //     res.statusCode = 500;
      //     res.end("Error querying database");
      //   }
      // }
    } else if (req.method === "GET" && path === "/count") {
      // get filters from query string
      let filters: { [column: string]: Filter } | null = null;
      if (parsedUrl.searchParams.has("filter")) {
        const filter = JSON.parse(
          decodeURIComponent(parsedUrl.searchParams.get("filter")!)
        );
        if (typeof filter === "object") {
          filters = filter;
        }
      }
      // get count of cells
      const f = buildWhereClauses(filters || {}, 1);
      const data = await pool.query({
        name:
          "count" +
          createHash("md5").update(JSON.stringify(filters)).digest("hex"),
        text: `
      select 
        count(distinct(id)) as count
      from 
        cells
      where 
        ${f.values.length > 0 ? f.where : "true"}
    `,
        values: f.values,
      });
      // add cors headers to allow all origins
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");
      // set cache headers
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.end(JSON.stringify({ count: parseInt(data.rows[0].count || 0) }));
    } else if (req.method === "GET" && path === "/ids") {
      if (parsedUrl.searchParams.has("resolution")) {
        const resolution = Number(parsedUrl.searchParams.get("resolution"));
        let filters: { [column: string]: Filter } | null = null;
        if (parsedUrl.searchParams.has("filter")) {
          const filter = JSON.parse(
            decodeURIComponent(parsedUrl.searchParams.get("filter")!)
          );
          if (typeof filter === "object") {
            filters = filter;
          }
        }
        if (!filters) {
          res.statusCode = 400;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end("Filter is required");
        }
        if (resolution < 6 || resolution > 9) {
          res.statusCode = 400;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end("Invalid resolution. Must be between 6 and 9");
        } else {
          const f = buildWhereClauses(filters || {}, 1);
          console.time("query");
          const data = await pool.query(
            `
          select 
            distinct(${resolution === 11 ? "id" : `r${resolution}_id`}) as id
          from
            cells
          where
            ${f.values.length > 0 ? f.where : "true"}
        `,
            f.values
          );
          console.timeEnd("query");
          // add cors headers to allow all origins
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          // set cache headers
          res.setHeader("Cache-Control", "public, max-age=60");
          res.end(
            JSON.stringify({
              ids: data.rows.map((row: any) => row.id),
              // count: parseInt(data.rows[0].count || 0),
            })
          );
        }
      } else {
        res.statusCode = 400;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end("Resolution is required");
      }
    } else if (req.method === "GET" && path === "/filter") {
      const resolution = Number(parsedUrl.searchParams.get("resolution"));
      let filters: { [column: string]: Filter } | null = null;
      if (parsedUrl.searchParams.has("filter")) {
        const filter = JSON.parse(
          decodeURIComponent(parsedUrl.searchParams.get("filter")!)
        );
        if (typeof filter === "object") {
          filters = filter;
        }
      }
      if (!filters) {
        res.statusCode = 400;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end("Filter is required");
      }
      if (resolution < 11) {
        const f = buildWhereClauses(filters || {}, 1);
        console.time("query");
        const query = `
          with filtered as (
            select
              distinct(r8_id) as id
            from
              cells
            where
              ${f.values.length > 0 ? f.where : "true"}
          ) 
          select
            h3_compact_cells(
              ARRAY_AGG(
                distinct(
                  h3_h3_to_string(id)
                )
              )
            ) as r8,
            h3_compact_cells(
              ARRAY_AGG(
                distinct(
                  h3_cell_to_parent(h3_h3_to_string(id), 7)
                )
              )
            ) as r7,
            h3_compact_cells(
              ARRAY_AGG(
                distinct(
                  h3_cell_to_parent(h3_h3_to_string(id), 6)
                )
              )
            ) as r6
            from filtered
          `;

        db.all(query, ...f.values, async (err: any, data: any) => {
          console.timeEnd("query");

          const count = (
            await get<{ count: number }>(
              `Select count(id)::int as count from cells where ${f.where}`,
              f.values
            )
          ).count;
          if (err) {
            console.error(err);
            res.statusCode = 500;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end("Error querying database");
            return;
          }
          type CellsByResolution = {
            [resolution: number]: string[];
          };
          const layers: {
            [displayResolution: number]: CellsByResolution;
          } = {};
          console.time("sort ids");
          for (const key in data[0]) {
            const cells = data[0][key];
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
          console.timeEnd("sort ids");
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
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Content-Type", "application/json");
          console.log(count);
          // res.end(JSON.stringify(counts));
          res.end(JSON.stringify({ count, layers }));
          // res.statusCode = 400;
          // res.setHeader("Access-Control-Allow-Origin", "*");
          // res.end("Not implemented");
        });
      } else {
        res.statusCode = 400;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end("Not implemented");
      }
    } else {
      res.statusCode = 404;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end("Not found");
    }
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end("Invalid URL");
  }
}).listen(3003, () => {
  console.log("Server is running on http://localhost:3003");
});

// async function getMVT(
//   z: number,
//   x: number,
//   y: number,
//   filters?: { [column: string]: Filter }
// ) {
//   const resolution = getResolutionForZoom(z);
//   const f = buildWhereClauses(filters || {});
//   const q = `
//   with mvtgeom as
//   (select
//     ST_AsMVTGeom(
//       st_transform(h3_cell_to_boundary_geometry(id), 3857),
//       ST_TileEnvelope($1,$2,$3),
//       4096,
//       64
//     ) as geom, id::text as hex from (
//       select
//         distinct(${resolution === 11 ? "id" : `r${resolution}_id`}) as id
//       from
//         cells
//       where
//         ST_INTERSECTS(geom, ST_TileEnvelope($1,$2,$3)) ${
//           f.values.length > 0 ? "AND " + f.where : ""
//         }
//     ) as geom
//   ) SELECT ST_AsMVT(mvtgeom.*) as buffer
//   FROM mvtgeom
//   `;
//   console.log(q);
//   const data = await pool.query({
//     name:
//       "mvt-r" +
//       resolution +
//       createHash("md5").update(JSON.stringify(filters)).digest("hex"),
//     text: q,
//     values: [z, x, y, ...f.values],
//   });
//   if (data.rows.length === 0) {
//     throw new Error("No data");
//   } else {
//     return data.rows[0].buffer;
//   }
// }

async function getText(
  z: number,
  x: number,
  y: number,
  filters?: { [column: string]: Filter }
) {
  const resolution = getResolutionForZoom(z);
  const f = buildWhereClauses(filters || {});
  console.log(f);
  const data = await pool.query({
    name:
      "mvt-text-r" +
      resolution +
      createHash("md5").update(JSON.stringify(filters)).digest("hex"),
    text: `
      select 
        distinct(${resolution === 11 ? "id" : `r${resolution}_id`}) as id
      from 
        cells
      where 
        ST_INTERSECTS(geom, ST_TileEnvelope($1,$2,$3)) ${
          f.values.length > 0 ? "AND " + f.where : ""
        }
  `,
    values: [z, x, y, ...f.values],
  });
  if (data.rows.length === 0) {
    return "";
  } else {
    return data.rows.map((row: any) => row.id).join("\n");
  }
}

function getResolutionForZoom(zoom: number) {
  return zoomToH3Resolution(zoom, stops);
}

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
  return (filter as NumberFilter).min !== undefined;
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
  return { where: whereClauses.join(" AND "), values };
}

function get<T>(query: string, values: any[] = []): Promise<T> {
  console.log(query, values);
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
