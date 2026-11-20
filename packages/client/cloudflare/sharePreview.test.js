import assert from "node:assert/strict";
import test from "node:test";
import {
  createPreviewCache,
  escapeHtml,
  injectPreview,
  loadProjectPreview,
  loadSharePreview,
  previewImageUrl,
  previewPageUrl,
  PROJECT_PREVIEW_TTL_MS,
  readPreview,
  shareTarget,
} from "./sharePreview.js";

const id = "11111111-1111-4111-8111-111111111111";

test("shareTarget reads layer and bookmark urls", () => {
  assert.deepEqual(shareTarget(`/demo.samoa/layers/${id}`), {
    type: "bookmark",
    slug: "demo.samoa",
    id,
  });
  assert.deepEqual(shareTarget(`/demo/bookmarks/${id}/`), {
    type: "bookmark",
    slug: "demo",
    id,
  });
  assert.deepEqual(shareTarget(`/demo/layers/${id}/extra`), {
    type: "page",
    slug: "demo",
    kind: "project",
  });
  assert.deepEqual(shareTarget("/demo/admin/data"), {
    type: "page",
    slug: "demo",
    kind: "project",
  });
});

test("shareTarget reads project, forum, topic, and message urls", () => {
  assert.deepEqual(shareTarget("/demo.samoa"), {
    type: "page",
    slug: "demo.samoa",
    kind: "project",
  });
  assert.deepEqual(shareTarget("/demo.samoa/app/"), {
    type: "page",
    slug: "demo.samoa",
    kind: "project",
  });
  assert.deepEqual(shareTarget("/demo/app/forums"), {
    type: "page",
    slug: "demo",
    kind: "project",
  });
  assert.deepEqual(shareTarget("/demo/app/sketches"), {
    type: "page",
    slug: "demo",
    kind: "project",
  });
  assert.deepEqual(shareTarget("/demo/app/forums/12/new-post"), {
    type: "page",
    slug: "demo",
    kind: "project",
  });
  assert.deepEqual(shareTarget("/demo/app/forums/12/"), {
    type: "page",
    slug: "demo",
    kind: "forum",
    forumId: 12,
  });
  assert.deepEqual(shareTarget("/demo/app/forums/12/34"), {
    type: "page",
    slug: "demo",
    kind: "topic",
    forumId: 12,
    topicId: 34,
  });
  assert.deepEqual(
    shareTarget("/demo/app/forums/12/34/", "?utm=1&post=56"),
    {
      type: "page",
      slug: "demo",
      kind: "post",
      forumId: 12,
      topicId: 34,
      postId: 56,
    }
  );
  assert.equal(shareTarget("/team"), null);
  assert.equal(shareTarget("/team/app"), null);
  assert.equal(shareTarget("/case-studies"), null);
  assert.equal(shareTarget("/case-studies/azores"), null);
  assert.equal(shareTarget("/uses/map-portal-hosting"), null);
  assert.deepEqual(shareTarget("/demo/app/forums/12/34", "?post=0"), {
    type: "page",
    slug: "demo",
    kind: "topic",
    forumId: 12,
    topicId: 34,
  });
  assert.equal(
    shareTarget("/demo/app/forums/12/34", "?post=9999999999").kind,
    "topic"
  );
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
    {
      title: "Land",
      description: "Land.",
      imageId: "abc",
      imageUrl: null,
      width: null,
      height: null,
    }
  );
  assert.equal(
    readPreview({
      title: "Land",
      description: "Land.",
      imageUrl: "javascript:alert(1)",
    }).imageUrl,
    null
  );
  assert.equal(
    readPreview({
      title: "Land",
      description: "Land.",
      imageUrl: "https://cdn.example/logo.png",
    }).imageUrl,
    "https://cdn.example/logo.png"
  );
});

test("previewPageUrl keeps the post query and drops the hash", () => {
  assert.equal(
    previewPageUrl(
      "https://www.seasketch.org",
      "/demo/app/forums/12/34/",
      { type: "page", kind: "post", postId: 56 }
    ),
    "https://www.seasketch.org/demo/app/forums/12/34?post=56"
  );
  assert.equal(
    previewPageUrl("https://www.seasketch.org", "/demo/app/", {
      type: "page",
      kind: "project",
    }),
    "https://www.seasketch.org/demo/app"
  );
});

test("loadSharePreview reads the graphql payload", async () => {
  const calls = [];
  const preview = await loadSharePreview(
    "https://api.example/graphql",
    { type: "bookmark", slug: "samoa", id },
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

test("loadSharePreview asks for a message preview", async () => {
  const calls = [];
  const preview = await loadSharePreview(
    "https://api.example/graphql",
    {
      type: "page",
      slug: "samoa",
      kind: "post",
      forumId: 4,
      topicId: 8,
      postId: 15,
    },
    async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          data: {
            pageLinkPreview: {
              title: "Reef survey",
              description: "The reef is healthy.",
              imageUrl: "https://cdn.example/logo.png",
            },
          },
        }),
      };
    }
  );
  assert.equal(preview.title, "Reef survey");
  assert.equal(preview.imageUrl, "https://cdn.example/logo.png");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.variables.kind, "post");
  assert.equal(body.variables.postId, 15);
  assert.match(body.query, /pageLinkPreview/);
});

function projectFetch(title) {
  let calls = 0;
  return {
    calls: () => calls,
    fetch: async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({
          data: {
            pageLinkPreview: title
              ? { title, description: "Maps of the coast." }
              : null,
          },
        }),
      };
    },
  };
}

test("project metadata is reused for five minutes", async () => {
  let now = 0;
  const cache = createPreviewCache(() => now);
  const graphql = projectFetch("American Samoa");
  const first = await loadProjectPreview(
    "https://api.example/graphql",
    "samoa",
    graphql.fetch,
    cache
  );
  const second = await loadProjectPreview(
    "https://api.example/graphql",
    "samoa",
    graphql.fetch,
    cache
  );
  assert.equal(first.title, "American Samoa");
  assert.equal(second, first);
  assert.equal(graphql.calls(), 1);

  const other = projectFetch("Vanuatu");
  await loadProjectPreview(
    "https://api.example/graphql",
    "vanuatu",
    other.fetch,
    cache
  );
  assert.equal(other.calls(), 1);
  assert.equal(graphql.calls(), 1);

  now = PROJECT_PREVIEW_TTL_MS;
  await loadProjectPreview(
    "https://api.example/graphql",
    "samoa",
    graphql.fetch,
    cache
  );
  assert.equal(graphql.calls(), 2);
  assert.equal(PROJECT_PREVIEW_TTL_MS, 5 * 60 * 1000);
});

test("a project with no public metadata stays cached", async () => {
  const cache = createPreviewCache();
  const graphql = projectFetch(null);
  assert.equal(
    await loadProjectPreview(
      "https://api.example/graphql",
      "secret",
      graphql.fetch,
      cache
    ),
    null
  );
  assert.equal(
    await loadProjectPreview(
      "https://api.example/graphql",
      "secret",
      graphql.fetch,
      cache
    ),
    null
  );
  assert.equal(graphql.calls(), 1);
});

test("concurrent project lookups share one query", async () => {
  const cache = createPreviewCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return {
      ok: true,
      json: async () => ({
        data: {
          pageLinkPreview: {
            title: "American Samoa",
            description: "Maps of the coast.",
          },
        },
      }),
    };
  };
  const [first, second] = await Promise.all([
    loadProjectPreview("https://api.example/graphql", "samoa", fetchImpl, cache),
    loadProjectPreview("https://api.example/graphql", "samoa", fetchImpl, cache),
  ]);
  assert.equal(first.title, "American Samoa");
  assert.equal(second.title, "American Samoa");
  assert.equal(calls, 1);
});

test("escapeHtml escapes attribute text", () => {
  assert.equal(escapeHtml(`a<b>"c"&`), "a&lt;b&gt;&quot;c&quot;&amp;");
});
