import { Router } from "express";
import { verify } from "./apiKeys";
import { DBClient } from "./dbClient";

/**
 * Make available information about a layer to clients with a project
 * API key. This should be useful for implementing geoprocessing
 * functions using data hosted on SeaSketch. This information includes:
 *   - mapbox-gl-styles (good for matching colors with cartography)
 *   - geostats - all sorts of useful statistics
 *   - data_upload_outputs - Find the fgb, geojson, or geotif
 *     representation of a source
 * @param loadersPool
 */
export default function layerApi(loadersPool: DBClient) {
  const router = Router();

  router.get("/:slug/:stableId", async (req, res) => {
    const bearerToken = req.headers.authorization;
    if (!bearerToken) {
      res.status(401).send("Unauthorized");
      return;
    }
    const apiKey = bearerToken.replace("Bearer ", "");
    const claims = await verify(apiKey, loadersPool);
    if (!claims) {
      res.status(401).send("Unauthorized");
      return;
    }
    const q1 = await loadersPool.query(
      `
        select 
          data_source_id,
          mapbox_gl_styles, 
          project_id 
        from 
          data_layers 
        where id = (
          select 
            data_layer_id 
          from 
            table_of_contents_items 
          where 
            stable_id = $1 and 
            is_draft = true and 
            project_id = (
              select id from projects where slug = $2
            )
          )`,
      [req.params.stableId, req.params.slug]
    );
    if (q1.rows.length === 0) {
      res.status(404).send("Not found");
      return;
    }
    const { data_source_id, mapbox_gl_styles, project_id } = q1.rows[0];
    if (project_id !== claims.projectId) {
      res.status(401).send("Unauthorized");
      return;
    }
    const q2 = await loadersPool.query(
      `select * from data_upload_outputs where data_source_id = $1`,
      [data_source_id]
    );
    const data_upload_outputs = q2.rows;
    const q3 = await loadersPool.query(
      `select geostats from data_sources where id = $1`,
      [data_source_id]
    );
    const geostats = q3.rows[0].geostats;
    res.json({ mapbox_gl_styles, data_upload_outputs, geostats });
  });

  return router;
}
