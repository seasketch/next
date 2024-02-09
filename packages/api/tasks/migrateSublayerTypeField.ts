import { Helpers } from "graphile-worker";
import { withTimeout } from "../src/withTimeout";

/**
 * @deprecated
 * This task is no longer needed now that the sublayer_type field is being
 * populated when layers are imported (Feb 9th, 2024).
 */
async function migrateSublayerTypeField(payload: {}, helpers: Helpers) {
  await helpers.withPgClient(async (client) => {
    // Get bookmark from db
    const { rows } = await client.query(
      `
      select 
        distinct(data_layers.data_source_id) as id, 
        data_sources.url as url
      from 
        data_layers 
      inner join 
        data_sources 
      on 
        data_sources.id = data_layers.data_source_id 
      where 
        sublayer is not null and 
        sublayer_type is null limit 10
    `,
      []
    );
    if (rows.length === 0) {
      return;
    }
    for (const row of rows as { id: number; url: string }[]) {
      const { id, url } = row;
      const response = await fetch(`${url}/layers?f=json`);
      const data = await response.json();
      for (const layer of data.layers) {
        if (layer.type === "Group Layer") {
          continue;
        }
        const sublayerId = layer.id.toString();
        let sublayerType = layer.type === "Feature Layer" ? "vector" : "raster";
        await client.query(
          `update data_layers set sublayer_type = $2 where data_source_id = $1 and sublayer = $3`,
          [id, sublayerType, sublayerId]
        );
      }
    }
  });
}

// Export with timeout
export default withTimeout(60000, migrateSublayerTypeField);
