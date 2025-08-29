import { Pool } from "pg";
import DataLoader from "dataloader";
import * as cache from "./cache";
import { Style } from "mapbox-gl";
import { sign, verify } from "./auth/jwks";
const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

export function makeDataLoaders(pool: Pool) {
  return {
    style: new DataLoader<string, Style | null>((urls) =>
      Promise.all(urls.map((url) => getStyle(url)))
    ),
    mapboxApiKey: new DataLoader<number, string>((ids) =>
      Promise.all(
        ids.map((projectId) => mapboxApiKeyForProject(projectId, pool))
      )
    ),
    offlineTilePackageBySource: new DataLoader<string, string[]>((keys) =>
      Promise.all(
        keys.map(async (key) => {
          const [projectId, dataSourceUrl] = key.split("\n");
          const result = await pool.query(
            `select * from offline_tile_packages where data_source_url = $1 and project_id = $2 order by created_at desc`,
            [dataSourceUrl, parseInt(projectId)]
          );
          return result.rows;
        })
      )
    ),
    signToken: async (claims: any, expires: string) => {
      const token = await sign(pool, claims, expires, ISSUER[0]);
      return token;
    },
    verifyToken: async (token: string) => {
      return verify(pool, token, ISSUER);
    },
    spatialMetricChunks: new DataLoader<number, any[]>((ids) =>
      Promise.all(
        ids.map(async (id) => {
          const results = await pool.query(
            `select *, ST_Envelope(bbox) as box from metric_work_chunks where spatial_metric_id = $1`,
            [id]
          );
          return results.rows.map((row) => {
            return {
              id: parseInt(row.id),
              state: row.state.toUpperCase(),
              spatialMetricId: parseInt(row.spatial_metric_id),
              errorMessage: row.error_message,
              value: JSON.parse(row.value),
              totalBytes: parseInt(row.total_bytes),
              offsets: row.offsets.map((offset: string) => parseInt(offset)),
              bbox: row.box.coordinates.map((coord: number) => coord),
              executionEnvironment: row.execution_environment.toUpperCase(),
              createdAt: new Date(row.created_at),
              updatedAt: row.updated_at ? new Date(row.updated_at) : null,
            };
          });
        })
      )
    ),
  };
}

async function getStyle(styleUrl: string) {
  const cached = await cache.get(styleUrl);
  if (cached) {
    const style = JSON.parse(cached) as Style;
    return style;
  } else {
    const response = await fetch(styleUrl);
    if (response.ok) {
      const style = await response.json();
      await cache.setWithTTL(styleUrl, JSON.stringify(style), 1000 * 60 * 2);
      return style as Style;
    } else {
      const text = await response.text();
      return null;
    }
  }
}

async function mapboxApiKeyForProject(projectId: number, pool: Pool) {
  const cacheKey = `project-mapbox-key-${projectId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  } else {
    let apiKey: string = process.env.MAPBOX_ACCESS_TOKEN!;
    const { rows } = await pool.query(
      `select mapbox_public_key from projects where id = $1`,
      [projectId]
    );
    if (rows.length && rows[0].mapbox_public_key?.length) {
      apiKey = rows[0].mapbox_public_key;
    }
    await cache.setWithTTL(cacheKey, apiKey, 1000 * 5);
    return apiKey;
  }
}
