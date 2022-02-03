import { DBClient } from "./dbClient";

export async function getFeatureCollection(
  surveyId: number,
  formElementId: number,
  client: DBClient
) {
  const results = await client.query(`select export_spatial_responses($1)`, [
    formElementId,
  ]);
  return results.rows[0].export_spatial_responses;
}
