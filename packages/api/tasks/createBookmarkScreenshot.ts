import { Helpers } from "graphile-worker";
import { sign } from "../src/auth/jwks";
import {
  captureBookmarkScreenshot,
  ScreenshotClip,
} from "../src/screenshotterClient";
import { withTimeout } from "../src/withTimeout";
import * as Sentry from "@sentry/node";

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

type CaptureSpan = {
  finish: () => void;
  startChild: (context: { op: string }) => CaptureSpan;
};

/** Sentry is optional. A capture must still run when no SDK is configured. */
function startCaptureTransaction(): CaptureSpan {
  const transaction = Sentry.startTransaction({
    name: "createBookmarkScreenshot",
  });
  if (transaction) {
    return transaction as unknown as CaptureSpan;
  }
  const noop: CaptureSpan = {
    finish() {},
    startChild() {
      return noop;
    },
  };
  return noop;
}

/**
 * Capture a map bookmark with the screenshotter Worker and store the
 * Cloudflare Images id.
 *
 * @param payload {id: number } bookmark id
 * @param helpers Graphile worker helpers
 */
async function createBookmarkScreenshot(
  payload: { id: string },
  helpers: Helpers
) {
  const transaction = startCaptureTransaction();

  await helpers.withPgClient(async (client) => {
    let span = transaction.startChild({ op: "query bookmark" });
    // Get bookmark from db
    const { rows } = await client.query(
      `
      select 
        map_bookmarks.id, 
        map_bookmarks.map_dimensions, 
        map_bookmarks.sidebar_state, 
        map_bookmarks.project_id, 
        map_bookmarks.user_id,
        users.canonical_email
      from 
        map_bookmarks 
      inner join users
      on users.id = map_bookmarks.user_id
      where map_bookmarks.id = $1
    `,
      [payload.id]
    );
    span.finish();
    span = transaction.startChild({ op: "setup and sign auth token" });
    const bookmark = rows[0];
    Sentry.setExtra("bookmark", bookmark);

    // Get the dimensions and clipping details for bookmark

    const { project_id, user_id, canonical_email } = bookmark;
    const token = await sign(
      client,
      {
        type: "sketch-geometry-access",
        userId: user_id,
        projectId: project_id,
        canonicalEmail: canonical_email,
      },
      "1 hour",
      ISSUER[0]
    );

    // Map-access JWT so protected hosted tiles/uploads load in the screenshot.
    const { rows: accessRows } = await client.query(
      `
      select
        p.slug,
        is_admin($2::int, $1::int) as is_admin,
        (
          select coalesce(array_agg(pg.id order by pg.id), '{}')
          from project_group_members pgm
          join project_groups pg on pg.id = pgm.group_id
          where pgm.user_id = $1 and pg.project_id = $2
        ) as group_ids
      from projects p
      where p.id = $2
      `,
      [user_id, project_id]
    );
    const projectSlug = accessRows[0]?.slug as string;
    const isAdmin = Boolean(accessRows[0]?.is_admin);
    const groups = ((accessRows[0]?.group_ids as number[]) ?? []).map(Number);
    const mapAccessToken = await sign(
      client,
      {
        type: "map-access",
        projectId: Number(project_id),
        projectSlug,
        userId: Number(user_id),
        role: isAdmin ? "admin" : "user",
        groups,
        isSuperuser: false,
      },
      "90 minutes",
      ISSUER[0]
    );

    const url = `${
      /localhost/.test(process.env.CLIENT_DOMAIN) ? "http" : "https"
    }://${process.env.CLIENT_DOMAIN}/screenshot.html?mt=${
      process.env.MAPBOX_ACCESS_TOKEN
    }&auth=${token}&mapAccess=${encodeURIComponent(mapAccessToken)}`;

    let clip: ScreenshotClip | undefined;

    span.finish();

    // If the sidebar is open, clip the screenshot to the map area
    span = transaction.startChild({ op: "update bookmark dimensions in db" });
    const [width, height] = bookmark.map_dimensions as [number, number];
    const sidebar = bookmark.sidebar_state as {
      open: boolean;
      width: number;
      isSmall: boolean;
    };
    if (sidebar.open && width >= 1080) {
      clip = {
        x: sidebar.width,
        y: 0,
        width: width - sidebar.width,
        height,
      };
      await client.query(
        `update map_bookmarks set map_dimensions = $1 where id = $2`,
        [[width - sidebar.width, height], bookmark.id]
      );
    }
    span.finish();

    // Get the bookmark style data and sprite images
    const { rows: bookmarkRows } = await client.query(
      `
      SELECT bookmark_data($1) as bookmark
        `,
      [bookmark.id]
    );
    const bookmarkData = bookmarkRows[0].bookmark;
    const { rows: spriteRows } = await client.query(
      `
      SELECT get_sprite_data_for_screenshot(map_bookmarks.*) as sprite_images from map_bookmarks where id = $1
        `,
      [bookmark.id]
    );

    bookmarkData.spriteImages = spriteRows[0].sprite_images;

    span = transaction.startChild({ op: "capture screenshot" });
    const image = await captureBookmarkScreenshot({
      width,
      height,
      clip,
      url,
      bookmarkData,
    });
    span.finish();

    span = transaction.startChild({ op: "update image id in db" });
    await client.query(`update map_bookmarks set image_id = $2 where id = $1`, [
      bookmark.id,
      image.id,
    ]);
    span.finish();
    transaction.finish();
  });
}

// The browser snapshot gives up after 60s. This also covers signing tokens
// and uploading the PNG to Cloudflare Images.
export default withTimeout(90000, createBookmarkScreenshot);
