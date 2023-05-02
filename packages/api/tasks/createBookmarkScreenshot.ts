import { Helpers } from "graphile-worker";
import puppeteer, { Browser, ScreenshotOptions } from "puppeteer";
import { sign } from "../src/auth/jwks";
import { withTimeout } from "../src/withTimeout";
import * as Sentry from "@sentry/node";
import AWS from "aws-sdk";

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || "us-west-2",
  httpOptions: {
    timeout: 120000,
  },
});

const ISSUER = (process.env.ISSUER || "seasketch.org")
  .split(",")
  .map((issuer) => issuer.trim());

const HOST =
  process.env.NODE_ENV !== "development" && process.env.ISSUER
    ? ISSUER[0]
    : "http://localhost:3857";

const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN;

// const _browser = puppeteer.launch({
//   headless: true,
//   defaultViewport: {
//     deviceScaleFactor: 2,
//     width: 1280,
//     height: 1024,
//   },
// });

function getBrowser() {
  // return _browser;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: {
      deviceScaleFactor: 2,
      width: 1280,
      height: 1024,
    },
  });
}

async function createBookmarkScreenshot(
  payload: { id: string },
  helpers: Helpers
) {
  const transaction = Sentry.startTransaction({
    name: "createBookmarkScreenshot",
  });

  await helpers.withPgClient(async (client) => {
    let span = transaction.startChild({ op: "query bookmark" });
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
    const [width, height] = bookmark.map_dimensions as [number, number];
    const sidebar = bookmark.sidebar_state as {
      open: boolean;
      width: number;
      isSmall: boolean;
    };

    Sentry.setExtra("bookmark", bookmark);
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

    const url = `${
      /localhost/.test(process.env.CLIENT_DOMAIN) ? "http" : "https"
    }://${process.env.CLIENT_DOMAIN}/screenshot.html?mt=${
      process.env.MAPBOX_ACCESS_TOKEN
    }&auth=${token}`;

    Sentry.setExtra("url", url);

    let clip: undefined | ScreenshotOptions["clip"] = undefined;

    span.finish();
    span = transaction.startChild({ op: "update bookmark dimensions in db" });
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
    const spriteImages = spriteRows[0].sprite_images;
    const lambdaPayload = {
      width,
      height,
      clip,
      url,
      bookmarkData,
    };
    span = transaction.startChild({ op: "invoke lambda" });

    const res = await lambda
      .invoke({
        FunctionName: process.env.SCREENSHOTTER_FUNCTION_ARN,
        Payload: JSON.stringify(lambdaPayload),
      })
      .promise();
    if (!res.Payload) {
      console.error(`map screenshot task invocation error`, res);
      throw new Error("Map screenshot lambda function invocation error");
    }
    span.finish();
    let lambdaResponseData: any;
    if (typeof res.Payload === "string") {
      lambdaResponseData = JSON.parse(res.Payload);
    } else {
      lambdaResponseData = res.Payload;
    }

    if (!lambdaResponseData.body) {
      throw new Error("Lambda response body is empty");
    }
    const body = JSON.parse(lambdaResponseData.body);

    span = transaction.startChild({ op: "update image id in db" });
    await client.query(`update map_bookmarks set image_id = $2 where id = $1`, [
      bookmark.id,
      body.id,
    ]);
    span.finish();
    transaction.finish();
  });
}
export default withTimeout(60000, createBookmarkScreenshot);
