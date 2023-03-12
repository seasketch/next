import { Helpers } from "graphile-worker";
import puppeteer, { ScreenshotOptions } from "puppeteer";
import sharp from "sharp";
import { encode } from "blurhash";
import { sign, verify } from "../src/auth/jwks";
const HOST = process.env.HOST || "seasketch.org";

const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN;

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

    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: {
        deviceScaleFactor: 2,
        width,
        height,
      },
    });
    const page = await browser.newPage();

    await page.goto(url);

    await page.waitForSelector("#loaded", {
      timeout: 10000,
    });
    const buffer = await page.screenshot({
      captureBeyondViewport: false,
      clip,
      path: "/Users/cburt/Downloads/puppeteer4.png",
    });

    const form = new FormData();
    const resized = await sharp(buffer).withMetadata({ density: 144 });
    const resizedBuffer = await resized
      .withMetadata({ density: 144 })
      .toBuffer();

    const { data: pixels, info: metadata } = await sharp(buffer)
      .resize(Math.round(width / 8), Math.round(height / 8))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const blurhash = encode(
      new Uint8ClampedArray(pixels),
      metadata.width!,
      metadata.height!,
      4,
      4
    );
    console.log(blurhash);
    await client.query(`update map_bookmarks set blurhash = $1 where id = $2`, [
      blurhash,
      bookmark.id,
    ]);

    form.append("file", new Blob([resizedBuffer]), `${bookmark.id}.png`);

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
    // await browser.close();
  });
}
export default createBookmarkScreenshot;
