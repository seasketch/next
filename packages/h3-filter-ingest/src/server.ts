import { Pool } from "pg";
import { createServer } from "http";
import { createHash } from "crypto";
import { stops, zoomToH3Resolution } from "./stops";

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
      console.log(
        "decoded",
        decodeURIComponent(parsedUrl.searchParams.get("filter")!)
      );
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
        console.log("filters", filters);
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
    } else if (ext === "json") {
    } else {
      try {
        const data = await getMVT(z, x, y, filters || {});
        console.timeEnd(`${z}/${x}/${y}.${ext}`);
        // add cors headers to allow all origins
        res.setHeader("Access-Control-Allow-Origin", "*");
        // add cache headers
        res.setHeader("Cache-Control", "public, max-age=60");
        res.setHeader("Content-Type", "application/vnd.mapbox-vector-tile");
        res.end(data);
      } catch (error) {
        console.error("Error querying database", error);
        res.statusCode = 500;
        res.end("Error querying database");
      }
    }
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
  } else {
    res.statusCode = 404;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end("Not found");
  }
}).listen(3003, () => {
  console.log("Server is running on http://localhost:3003");
});

async function getMVT(
  z: number,
  x: number,
  y: number,
  filters?: { [column: string]: Filter }
) {
  const resolution = getResolutionForZoom(z);
  const f = buildWhereClauses(filters || {});
  const q = `
  with mvtgeom as 
  (select 
    ST_AsMVTGeom(
      st_transform(h3_cell_to_boundary_geometry(id), 3857),
      ST_TileEnvelope($1,$2,$3),
      4096,
      64
    ) as geom, id::text as hex from (
      select 
        distinct(${resolution === 11 ? "id" : `r${resolution}_id`}) as id 
      from 
        cells 
      where 
        ST_INTERSECTS(geom, ST_TileEnvelope($1,$2,$3)) ${
          f.values.length > 0 ? "AND " + f.where : ""
        }
    ) as geom
  ) SELECT ST_AsMVT(mvtgeom.*) as buffer
  FROM mvtgeom
  `;
  console.log(q);
  const data = await pool.query({
    name:
      "mvt-r" +
      resolution +
      createHash("md5").update(JSON.stringify(filters)).digest("hex"),
    text: q,
    values: [z, x, y, ...f.values],
  });
  if (data.rows.length === 0) {
    throw new Error("No data");
  } else {
    return data.rows[0].buffer;
  }
}

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

type Stop = {
  h3Resolution: number;
  zoomLevel: number;
};

function getResolutionForZoom(zoom: number) {
  return zoomToH3Resolution(zoom, stops);
}

type NumberFilter = {
  min: number;
  max: number;
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
      whereClauses.push(
        `${column} >= $${valueStartIndex} AND ${column} <= $${
          valueStartIndex + 1
        }`
      );
      values.push(filter.min, filter.max);
      valueStartIndex += 2;
    } else if (isBooleanFilter(filter)) {
      whereClauses.push(`${column} = $${valueStartIndex}`);
      values.push(filter.bool);
      valueStartIndex++;
    } else if (isStringFilter(filter)) {
      whereClauses.push(
        `${column} IN (${filter.choices
          .map((_, i) => `$${valueStartIndex + i}`)
          .join(", ")})`
      );
      values.push(...filter.choices);
      valueStartIndex += filter.choices.length;
    }
  }
  return { where: whereClauses.join(" AND "), values };
}
