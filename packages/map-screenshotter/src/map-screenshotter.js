const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const uuid = require("uuid").v4;

const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN;
const CLOUDFLARE_IMAGES_ACCOUNT = process.env.CLOUDFLARE_IMAGES_ACCOUNT;

exports.handler = async (event) => {
  try {
    const { width, height, url, clip, bookmarkData } = event;
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    const page = await browser.newPage();

    page.setViewport({
      width,
      height,
      deviceScaleFactor: 2,
    });
    console.log("goto");
    await page.goto(
      url,
      event.skipWaitForLoaded
        ? {
            waitUntil: "networkidle2",
          }
        : undefined
    );

    page
      .on("console", (message) =>
        console.log(
          `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
        )
      )
      .on("pageerror", ({ message }) => console.log(message))
      .on("response", (response) =>
        console.log(`${response.status()} ${response.url()}`)
      )
      .on("requestfailed", (request) =>
        console.log(`${request.failure().errorText} ${request.url()}`)
      );

    await page.evaluate((bookmarkData) => {
      window.showBookmark(bookmarkData);
    }, bookmarkData);
    console.log("done evaluating");

    console.log("wait for #loaded");
    if (!event.skipWaitForLoaded) {
      await page.waitForSelector("#loaded", {
        timeout: 60000,
      });
    } else {
      await page.waitForSelector("#log-messages", { timeout: 10000 });
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("take screenshot");
    const buffer = await page.screenshot({
      captureBeyondViewport: false,
      clip,
    });
    console.log("close page");
    await page.close();
    console.log("images token", CLOUDFLARE_IMAGES_TOKEN);
    console.log("close browser");

    const form = new FormData();
    form.append("file", new Blob([buffer]), `${uuid()}.png`);
    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_IMAGES_TOKEN}`,
      },
    };
    options.body = form;
    console.log("sending to cloudlare");
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT}/images/v1`,
      options
    );
    const data = await response.json();
    console.log("got response from cloudflare");
    await browser.close();
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: data.result.id,
        variants: data.result.variants,
      }),
    };
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};
