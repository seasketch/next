import { Helpers } from "graphile-worker";
import puppeteer, { Browser, ScreenshotOptions } from "puppeteer";
import sharp from "sharp";
import { encode } from "blurhash";
import { sign } from "../src/auth/jwks";
import { withTimeout } from "../src/withTimeout";
const HOST = process.env.HOST || "seasketch.org";

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
  await helpers.withPgClient(async (client) => {
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
    const bookmark = rows[0];
    const [width, height] = bookmark.map_dimensions as [number, number];
    const sidebar = bookmark.sidebar_state as {
      open: boolean;
      width: number;
      isSmall: boolean;
    };

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
    }&auth=${token}&bookmarkUrl=http://localhost:3857/bookmarks/${bookmark.id}`;

    let clip: undefined | ScreenshotOptions["clip"] = undefined;

    if (sidebar.open && width >= 1080) {
      clip = {
        x: sidebar.width,
        y: 0,
        width: width - sidebar.width,
        height,
      };
    }

    const browser = await getBrowser();
    const page = await browser.newPage();
    page.setViewport({
      width,
      height,
      deviceScaleFactor: 2,
    });

    await page.goto(url);

    await page.waitForSelector("#loaded", {
      timeout: 10000,
    });
    const buffer = await page.screenshot({
      captureBeyondViewport: false,
      clip,
    });

    const form = new FormData();
    const { data: resizedBuffer, info: resizedMetadata } = await sharp(buffer)
      .withMetadata({ density: 144 })
      .toBuffer({ resolveWithObject: true });

    const { data: pixels, info: metadata } = await sharp(buffer)
      .resize(Math.round(clip!.width / 10), Math.round(clip!.height / 10))
      .raw()
      .toBuffer({ resolveWithObject: true });
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

    form.append("file", new Blob([buffer]), `${bookmark.id}.png`);

    const options: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_IMAGES_TOKEN}`,
      },
    };

    options.body = form;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_IMAGES_ACCOUNT}/images/v1`,
      options
    );
    const data = await response.json();
    await client.query(
      `update map_bookmarks set image_id = $2, blurhash = $3 where id = $1`,
      [bookmark.id, data.result.id, blurhash]
    );
  });
}
export default withTimeout(20000, createBookmarkScreenshot);
