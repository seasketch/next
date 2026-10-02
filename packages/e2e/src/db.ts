import { Client } from "pg";
import { databaseURL } from "./config";

/**
 * Remove a journey's project for real. GraphQL delete_project only marks the
 * row deleted and keeps the slug.
 */
export async function hardDeleteProject(slug: string) {
  const client = new Client({ connectionString: databaseURL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id FROM projects WHERE slug = $1", [
      slug,
    ]);
    if (found.rowCount === 0) {
      await client.query("ROLLBACK");
      return;
    }
    const id = found.rows[0].id;
    // These foreign keys are NO ACTION. Everything else that references
    // projects cascades.
    for (const table of [
      "offline_tile_packages",
      "project_map_data_requests",
      "project_visitor_metrics",
      "project_activity",
      "community_guidelines",
      "offline_tile_settings",
      "project_visitors",
    ]) {
      await client.query(`DELETE FROM ${table} WHERE project_id = $1`, [id]);
    }
    await client.query("DELETE FROM projects WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
