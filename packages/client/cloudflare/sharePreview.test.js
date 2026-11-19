import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeHtml,
  injectPreview,
  isPreviewBot,
  loadSharePreview,
  previewImageUrl,
  readPreview,
  shareTarget,
} from "./sharePreview.js";

const id = "11111111-1111-4111-8111-111111111111";

test("shareTarget reads layer and bookmark urls", () => {
  assert.deepEqual(shareTarget(`/demo.samoa/layers/${id}`), {
    slug: "demo.samoa",
    id,
  });
  assert.deepEqual(shareTarget(`/demo/bookmarks/${id}/`), {
    slug: "demo",
    id,
  });
  assert.equal(shareTarget(`/demo/layers/${id}/extra`), null);
  assert.equal(shareTarget("/demo/app"), null);
  assert.equal(shareTarget("/demo/admin/data"), null);
});

test("isPreviewBot matches link-preview crawlers and not browsers", () => {
  assert.equal(
    isPreviewBot("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"),
    true
  );
  assert.equal(isPreviewBot("Twitterbot/1.0"), true);
  assert.equal(
    isPreviewBot(
      "Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)"
    ),
    true
  );
  assert.equal(
    isPreviewBot(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
    ),
    false
  );
  assert.equal(isPreviewBot(null), false);
});

test("injectPreview replaces the title and description and escapes text", () => {
  const html = `<!DOCTYPE html><html><head>
    <meta name="description" content="SeaSketch is the platform." />
    <title>SeaSketch</title>
  </head><body></body></html>`;
  const result = injectPreview(
    html,
    {
      title: 'Land & "reef"',
      description: "Land on the Samoa map.",
      width: 1200,
      height: 800,
    },
    "https://www.seasketch.org/samoa/layers/1",
    "https://images.example/land/public"
  );
  assert.match(result, /<title>Land &amp; &quot;reef&quot;<\/title>/);
  assert.match(result, /name="description" content="Land on the Samoa map."/);
  assert.match(result, /property="og:image" content="https:\/\/images\.example\/land\/public"/);
  assert.match(result, /property="og:image:width" content="1200"/);
  assert.match(result, /name="twitter:card" content="summary_large_image"/);
  assert.doesNotMatch(result, /SeaSketch is the platform/);
});

test("injectPreview omits the image when there is no screenshot yet", () => {
  const result = injectPreview(
    "<head><title>SeaSketch</title></head>",
    { title: "Land", description: "Land on the Samoa map." },
    "https://www.seasketch.org/samoa/layers/1",
    null
  );
  assert.doesNotMatch(result, /og:image/);
  assert.match(result, /name="twitter:card" content="summary"/);
});

test("previewImageUrl uses the same prefix as the client", () => {
  assert.equal(
    previewImageUrl("https://imagedelivery.net/hash/", "abc"),
    "https://imagedelivery.net/hash/abc/public"
  );
  assert.equal(previewImageUrl("", "abc"), null);
  assert.equal(previewImageUrl("https://images.example/", null), null);
});

test("readPreview rejects a missing title", () => {
  assert.equal(readPreview(null), null);
  assert.equal(readPreview({ description: "x" }), null);
  assert.deepEqual(
    readPreview({ title: "Land", description: "Land.", imageId: "abc", width: 0 }),
    { title: "Land", description: "Land.", imageId: "abc", width: null, height: null }
  );
});

test("loadSharePreview reads the graphql payload", async () => {
  const calls = [];
  const preview = await loadSharePreview(
    "https://api.example/graphql",
    { slug: "samoa", id },
    async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          data: {
            bookmarkLinkPreview: {
              title: "Land",
              description: "Land on the Samoa map.",
              imageId: "img",
            },
          },
        }),
      };
    }
  );
  assert.equal(preview.title, "Land");
  assert.equal(preview.imageId, "img");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.variables.slug, "samoa");
  assert.equal(body.variables.id, id);
});

test("escapeHtml escapes attribute text", () => {
  assert.equal(escapeHtml(`a<b>"c"&`), "a&lt;b&gt;&quot;c&quot;&amp;");
});
