import fs from "fs";
import { expect, test } from "@playwright/test";
import { personas } from "../src/config";
import { openMap, signIn, visibleButton } from "../src/project";

/**
 * Forum attachments for non-image files are presigned against local R2
 * (ssn-file-uploads-local on the e2e profile's Miniflare). Images go to
 * Cloudflare Images and are not this journey.
 */
const localFileUploads = /https?:\/\/(localhost|127\.0\.0\.1):18333\/.*ssn-file-uploads-local\//;

test.describe("demo-samoa forum attachments @enduser @forums", () => {
  test("a participant attaches a file and can download it from local storage", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const filename = `field-notes-${Date.now().toString(36)}.txt`;
    const contents = `forum attachment ${filename}\n`;

    await signIn(page, request, personas.admin);
    await openMap(page, "/demo-samoa/app");
    await visibleButton(page, "Discussion Forums").click();
    await page.getByRole("heading", { name: "Public Forum", level: 3 }).click();
    await page.getByRole("link", { name: /Welcome to the project/ }).click();

    await page.locator(".ProseMirror").click();
    await visibleButton(page, /^Share( content)?$/).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "File Upload" }).click();
    const chooser = await chooserPromise;

    const uploaded = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        localFileUploads.test(response.url())
    );
    await chooser.setFiles({
      name: filename,
      mimeType: "text/plain",
      buffer: Buffer.from(contents),
    });
    const put = await uploaded;
    expect(put.ok(), put.url()).toBe(true);
    expect(put.url()).not.toMatch(/cloudflarestorage|imagedelivery\.net|seasketch\.org/);

    const draft = page.getByRole("button", { name: filename });
    await expect(draft).toBeVisible();

    const reply = `Notes are attached as ${filename}.`;
    await page.locator(".ProseMirror").click();
    await page.keyboard.type(reply);
    await page.getByRole("button", { name: "Post Reply" }).click();

    const posted = page.locator("[id^='post-']").filter({ hasText: reply });
    const attachment = posted.getByRole("button", { name: filename });
    await expect(attachment).toBeVisible();

    // The click follows the presigned URL. Capture the bytes in the route so
    // a download navigation does not drop the response body.
    let saved: { url: string; body: Buffer } | undefined;
    await page.route(localFileUploads, async (route) => {
      const response = await route.fetch();
      const body = await response.body();
      saved = { url: route.request().url(), body };
      await route.fulfill({ response, body });
    });
    const downloaded = page.waitForEvent("download");
    await attachment.click();
    await expect.poll(() => saved?.body.toString()).toBe(contents);
    expect(saved!.url).toMatch(localFileUploads);
    expect(saved!.url).not.toMatch(/cloudflarestorage|imagedelivery\.net|seasketch\.org/);

    const download = await downloaded;
    expect(download.suggestedFilename()).toBe(filename);
    expect(localFileUploads.test(download.url())).toBe(true);
    expect((await fs.promises.readFile(await download.path())).toString()).toBe(
      contents
    );
  });
});