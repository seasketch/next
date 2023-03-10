import { Helpers } from "graphile-worker";
import puppeteer, { ScreenshotOptions } from "puppeteer";
import sharp from "sharp";
import { sign, verify } from "../src/auth/jwks";
const HOST = process.env.HOST || "seasketch.org";

const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN;
// const authToken =
// "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjhkOGJjN2FlLWEzNjMtNDQ4OC04MjNjLWU4MDNjNmI5M2VmNSIsImprdSI6Imh0dHBzOi8vc2Vhc2tldGNoLm9yZy8ud2VsbC1rbm93bi9qd2tzLmpzb24ifQ.eyJ0eXBlIjoic2tldGNoLWdlb21ldHJ5LWFjY2VzcyIsInVzZXJJZCI6MiwicHJvamVjdElkIjoyLCJjYW5vbmljYWxFbWFpbCI6InVuZGVyYmx1ZXdhdGVyc0BnbWFpbC5jb20iLCJpYXQiOjE2Nzg0NjU5MjQsImV4cCI6MTY3ODU1MjMyNCwiaXNzIjoiaHR0cHM6Ly9zZWFza2V0Y2gub3JnIn0.gWQaZo11W7dfCCAyrRZh2gw2Pr7VGmeYLl5079eFfrFkdfWWbT5rah1wBcl_88TCFk6fHHmWfZFW9Qm8HLMcZDLZbRmSIRiNDvpUoe3QbE0OY_1ZyDIJTK7Jy6iBRXExtvAfnAJ3Tj2fAlvAp0lsC0HfqUFUmYuFa1Aicv_15XwfIuP5gQCA4xqX_9FNsoaALJGRxynf2HWGSqsTTcEpy1-AuOBpryfmKiLw1UAkv8feE_ARGGqpd0jPWihpSde4OpgchvWK1AFj0jw-FcdABxOy3d6JQnvM5OvkvOGBlROE3j1mGZ33mxCBziTNEY4gBU1zcuQ9WYglMkMh34QIuzb2CNLEMzqii9EQ1rS9Lnv1oMzsNz_M9zDVGgNjbhz9R4LKetYnU-Gb6vZxGKOENprTtS2-KYbP2rFnkEYWuKwR6sDZwSc7iopJvvLmSJmLzkqlKbv5uDNV3KPZtLLHOjcd4LQ4ptyvtWjCyHu5yevVm_A0GHJ_haPKx7WZ1pfaMu1lFpvsVwG9EtkWEhPgjzdH2dkeL10fuFPwXHHX8YfurjJ2KxAcE57rt0JAeXArAdyxSENdHZvKJA5o1WCg0PEAGhqf2SxZn1pXJxWNsoZudm8pL1azd6aN_1a1cD4qJQHpyl0BFebIUe_CO317hi79UDCI0lW1uR9RPoCv5m0";

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
    console.log(await resized.metadata());
    form.append(
      "file",
      new Blob([await resized.withMetadata({ density: 144 }).toBuffer()]),
      `${bookmark.id}.png`
    );

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
    console.log(data);
    await client.query(`update map_bookmarks set image_id = $2 where id = $1`, [
      bookmark.id,
      data.result.id,
    ]);
    await browser.close();
  });
}
export default createBookmarkScreenshot;
