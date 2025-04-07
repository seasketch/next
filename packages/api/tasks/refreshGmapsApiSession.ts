import { Helpers } from "graphile-worker";

/**
 * graphile-worker task which requests new google maps 2d tile api
 * sessions.
 * @param payload
 * @param helpers
 */
export default async function refreshGmapsApiSession(
  payload: { jobId: string },
  helpers: Helpers
) {
  const { jobId } = payload;
  helpers.logger.info(`Fetching new gmaps api session for 2d satellite tiles`);
  await helpers.withPgClient(async (client) => {
    const { GOOGLE_MAPS_2D_TILE_API_KEY } = process.env;
    if (!GOOGLE_MAPS_2D_TILE_API_KEY) {
      throw new Error(
        "Cannot refresh gmaps api session without GOOGLE_MAPS_2D_TILE_API_KEY"
      );
    }
    const url = `https://tile.googleapis.com/v1/createSession?key=${GOOGLE_MAPS_2D_TILE_API_KEY}`;
    // make an http post request to the google maps api to create a new session
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Referer: "https://www.seasketch.org",
      },
      body: JSON.stringify({
        mapType: "satellite", // specify the map type
        language: "en-US", // specify the language for the session
        region: "US", // specify the region for the session
        highDpi: true,
        scale: "scaleFactor4x",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to create gmaps api session: ${response.status} ${text}`
      );
    }
    const data = await response.json();
    if (!data || !data.session) {
      throw new Error(
        `Failed to parse gmaps api session response: ${JSON.stringify(data)}`
      );
    }

    helpers.logger.info(
      `Successfully created gmaps api session for 2d tiles: ${data.session}`
    );

    // use update_google_maps_tile_api_session function to store the session in the database
    helpers.logger.info(data);
    const results = await client.query(
      `
        select update_google_maps_tile_api_session($1, $2, $3, $4, $5, $6, $7, $8) as success
      `,
      [
        "satellite",
        "en-US", // language
        "US", // region
        new Date(parseInt(data.expiry) * 1000),
        data.session,
        data.tileWidth,
        data.tileHeight,
        data.imageFormat,
      ]
    );

    // const results = await client.query(
    //   `update project_background_jobs set progress_message = 'processing', state = 'running', started_at = now() where id = $1 returning *`,
    //   [jobId]
    // );
  });
}
