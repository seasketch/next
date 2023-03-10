import puppeteer, { ScreenshotOptions } from "puppeteer";
import sharp from "sharp";

const CLOUDFLARE_IMAGES_TOKEN = "HWe82wdftsTepnuGc56ZGlc7zPMt6mXPbAaRr2SA";
const CLOUDFLARE_IMAGES_ACCOUNT = "3f258747d0cb255bef8e96e3ae2b3fac";
const bookmark = "de553f50-0dc1-4d1c-bd79-2e7c8646ba54";
const url = `http://localhost:3000/screenshot.html?auth=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjMwMDYwNzBjLTEyNWMtNDE2Zi1iOThmLTU4ZDU3NzUzYjAwZiIsImprdSI6Imh0dHBzOi8vc2Vhc2tldGNoLm9yZy8ud2VsbC1rbm93bi9qd2tzLmpzb24ifQ.eyJ0eXBlIjoic2tldGNoLWdlb21ldHJ5LWFjY2VzcyIsInVzZXJJZCI6MywicHJvamVjdElkIjoyLCJjYW5vbmljYWxFbWFpbCI6InVuZGVyYmx1ZXdhdGVyc0BnbWFpbC5jb20iLCJpYXQiOjE2NzgzOTUwNDQsImV4cCI6MTY3ODQ4MTQ0NCwiaXNzIjoiaHR0cHM6Ly9zZWFza2V0Y2gub3JnIn0.UvdaDeLQSTu-53tuXjlYsRJTcisWv9wpQO6cgoDSon6NC2a3pyDmTYoteqiPp14DSg24rKUXOpMnf8lRwSYCFa61TKv_rLF2ESdHv2RqJog3jmuGL3IdGu4xJFU2t3vNspvZhYn9JJNoJJMNZhENE-Wo-u9jXxgl5pMMr_Gorn7GDTmqptByZSnH0pGZwU8M6y-E_j70EZnsjFJANHOZiz0BXYODTZlr7MiiChXyu6KlZV3WU7195L9WMJHVFxsBzDw0t5kgRxU0h2AfxKGMvyg7JN9BTnUDk-seMG2CU3zajZd1FecXYH7nJSj6NxrRRzKcBqniF5fJZiVaUKZpEd8bMzEE2c4XQQR-4fF-B3EaaHW3jDNnCH8ogGZtEdlKI6Ick18juTXMKRUbuW79J9Hf2h6YucEdl6Krl9xwt36NArI5xID8q55MvgU4q4Ub0r7-nGQYG__448mrWvJ_iZ_ULBGdf9PHePu1rM4_aYqhd7pZos5QK6oIonkdBox0ulb_FbsNnbnm2hN1B-PcNQNxrtrj9SXExCpEx7SW871rYLSvrdCOFbO_ygAv93fVWw4RzYU-HiQevXgHkMP1L-ig962wbMMuq4Qx96E1dRWZ_lFyOMBHsqBC_FbchSjJBTLlRzEe3QhjQkof8bJzQ88eHe-ee63KcmdXHsjI-_I&mt=pk.eyJ1Ijoic2Vhc2tldGNoIiwiYSI6ImNremN6bnF1YzJudHYycG8wZGJnaDk1cjUifQ.lXZs4Zm0LDrbob_DUzgIyg&bookmarkUrl=http://localhost:3857/bookmarks/${bookmark}`;

const screen = [2125, 1023];
const sidebarState = {
  open: true,
  width: 512,
  isSmall: false,
};

let clip: undefined | ScreenshotOptions["clip"] = undefined;

if (sidebarState.open) {
  clip = {
    x: sidebarState.width,
    y: 0,
    width: screen[0] - sidebarState.width,
    height: screen[1],
  };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      deviceScaleFactor: 2,
      width: screen[0],
      height: screen[1],
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
    path: "/Users/cburt/Downloads/puppeteer3.png",
  });

  const form = new FormData();
  const resized = await sharp(buffer).withMetadata({ density: 144 });
  console.log(await resized.metadata());
  form.append(
    "file",
    new Blob([await resized.withMetadata({ density: 144 }).toBuffer()]),
    `${bookmark}.png`
  );

  const options: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_IMAGES_TOKEN}`,
    },
  };

  options.body = form;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_IMAGES_ACCOUNT}/images/v1`,
    options
  );
  try {
    const data = await response.json();
    console.log(data);
    await browser.close();
    process.exit();
  } catch (e) {
    console.error(e);
    const text = await response.text();
    console.log(text);
    process.exit(-1);
  }
})();
