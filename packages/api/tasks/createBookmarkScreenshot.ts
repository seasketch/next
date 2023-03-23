import { Helpers } from "graphile-worker";
import puppeteer, { Browser, ScreenshotOptions } from "puppeteer";
import sharp from "sharp";
import { encode } from "blurhash";
import { sign } from "../src/auth/jwks";
import { withTimeout } from "../src/withTimeout";
import * as Sentry from "@sentry/node";
const HOST =
  process.env.HOST || process.env.NODE_ENV === "production"
    ? "https://api.seasket.ch"
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
      HOST
    );

    const url = `${
      /localhost/.test(process.env.CLIENT_DOMAIN) ? "http" : "https"
    }://${process.env.CLIENT_DOMAIN}/screenshot.html?mt=${
      process.env.MAPBOX_ACCESS_TOKEN
    }&auth=${token}&bookmarkUrl=${HOST}/bookmarks/${bookmark.id}`;

    console.log(`Loading page: ${url}`);
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
    span = transaction.startChild({ op: "open page in browser" });
    const browser = await getBrowser();
    console.log("got browser");
    const page = await browser.newPage();
    page
      .on("console", (message) =>
        console.log(
          `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
        )
      )
      .on("pageerror", (error) => console.log(error.toString()))
      .on("response", (response) =>
        console.log(`${response.status()} ${response.url()}`)
      )
      .on("requestfailed", (request) =>
        console.log(`${request.failure().errorText} ${request.url()}`)
      );
    page.setViewport({
      width,
      height,
      deviceScaleFactor: 2,
    });

    await page.goto(url);
    console.log("went to url");

    await page.waitForSelector("#loaded", {
      timeout: 20000,
    });
    span.finish();
    span = transaction.startChild({ op: "take screenshot" });
    console.log("take screenshot");
    const buffer = await page.screenshot({
      captureBeyondViewport: false,
      clip,
    });
    console.log("buffer length", buffer.length);
    span.finish();
    span = transaction.startChild({ op: "resize screenshot" });
    console.log("resize screenshot");
    const form = new FormData();
    const { data: resizedBuffer, info: resizedMetadata } = await sharp(buffer)
      .withMetadata({ density: 144 })
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info: metadata } = await sharp(buffer)
      .resize(
        Math.round(clip ? clip.width / 10 : width / 10),
        Math.round(clip ? clip.height / 10 : height / 10)
      )
      .raw()
      .toBuffer({ resolveWithObject: true });
    console.log("create blurhash");
    const blurhash = encode(
      new Uint8ClampedArray(pixels),
      metadata.width,
      metadata.height,
      3,
      3
    );
    await client.query(`update map_bookmarks set blurhash = $1 where id = $2`, [
      blurhash,
      bookmark.id,
    ]);
    console.log("saved blurhash");
    span.finish();
    span = transaction.startChild({ op: "send to cloudflare" });
    form.append("file", new Blob([buffer]), `${bookmark.id}.png`);

    const options: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_IMAGES_TOKEN}`,
      },
    };

    options.body = form;

    console.log(
      "sendiing to cloudlare",
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_IMAGES_ACCOUNT}/images/v1`,
      options
    );
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_IMAGES_ACCOUNT}/images/v1`,
      options
    );
    const data = await response.json();
    console.log("response from cloudflare");
    console.log(data);
    Sentry.setExtra("cloudflare response", data);
    span.finish();
    span = transaction.startChild({ op: "update image id in db" });
    console.log("update map bookmarks with id");
    await client.query(
      `update map_bookmarks set image_id = $2, blurhash = $3 where id = $1`,
      [bookmark.id, data.result.id, blurhash]
    );
    span.finish();
    transaction.finish();
  });
}
export default withTimeout(30000, createBookmarkScreenshot);
