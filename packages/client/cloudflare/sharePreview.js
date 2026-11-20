/**
 * Link previews for shared SeaSketch URLs.
 *
 * Slack, Facebook, X, iMessage, and the rest read Open Graph tags from the
 * first HTML response. They do not run the React app, and they do not send
 * the URL hash. Bookmark and layer links use bookmarkLinkPreview. Project,
 * forum, topic, and message links use pageLinkPreview. A message link puts
 * the post id in the query string because the #post- fragment never arrives.
 */

const SHARE_PATH =
  /^\/([^/]+)\/(layers|bookmarks)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

const PROJECT_APP_PATH = /^\/([^/]+)\/app\/?$/;
const FORUM_LIST_PATH = /^\/([^/]+)\/app\/forums\/?$/;
const FORUM_PATH = /^\/([^/]+)\/app\/forums\/(\d+)\/?$/;
const TOPIC_PATH = /^\/([^/]+)\/app\/forums\/(\d+)\/(\d+)\/?$/;
const PROJECT_ROOT_PATH = /^\/([^/]+)\/?$/;

// These first path segments are site pages, not project slugs.
const SITE_ROOTS = new Set([
  "signin",
  "projects",
  "new-project",
  "authenticate",
  "api",
  "team",
  "terms-of-use",
  "privacy-policy",
  "data-handling",
  "subprocessors",
  "dashboard",
  "account-settings",
  "submit-offline-surveys",
  "uses",
  "case-studies",
  "sprites",
  "static",
]);

const BOOKMARK_QUERY = `query BookmarkLinkPreview($slug: String!, $id: UUID!) {
  bookmarkLinkPreview(slug: $slug, id: $id)
}`;

const PAGE_QUERY = `query PageLinkPreview($slug: String!, $kind: String!, $forumId: Int, $topicId: Int, $postId: Int) {
  pageLinkPreview(slug: $slug, kind: $kind, forumId: $forumId, topicId: $topicId, postId: $postId)
}`;

function positiveInt(value) {
  if (!/^[1-9]\d{0,9}$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 2147483647) {
    return null;
  }
  return parsed;
}

function postIdFromSearch(search) {
  const params = new URLSearchParams(
    typeof search === "string" ? search : ""
  );
  const raw = params.get("post");
  if (raw == null) {
    return null;
  }
  return positiveInt(raw);
}

export function shareTarget(pathname, search = "") {
  const bookmark = SHARE_PATH.exec(pathname);
  if (bookmark) {
    return { type: "bookmark", slug: bookmark[1], id: bookmark[3] };
  }

  let match = PROJECT_APP_PATH.exec(pathname);
  if (match) {
    return { type: "page", slug: match[1], kind: "project" };
  }
  match = FORUM_LIST_PATH.exec(pathname);
  if (match) {
    return { type: "page", slug: match[1], kind: "forums" };
  }
  match = FORUM_PATH.exec(pathname);
  if (match) {
    const forumId = positiveInt(match[2]);
    if (!forumId) {
      return null;
    }
    return { type: "page", slug: match[1], kind: "forum", forumId };
  }
  match = TOPIC_PATH.exec(pathname);
  if (match) {
    const forumId = positiveInt(match[2]);
    const topicId = positiveInt(match[3]);
    if (!forumId || !topicId) {
      return null;
    }
    const postId = postIdFromSearch(search);
    if (postId) {
      return {
        type: "page",
        slug: match[1],
        kind: "post",
        forumId,
        topicId,
        postId,
      };
    }
    return {
      type: "page",
      slug: match[1],
      kind: "topic",
      forumId,
      topicId,
    };
  }
  match = PROJECT_ROOT_PATH.exec(pathname);
  if (match && !SITE_ROOTS.has(match[1].toLowerCase())) {
    return { type: "page", slug: match[1], kind: "project" };
  }
  return null;
}

export function previewImageUrl(endpoint, imageId) {
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return null;
  }
  if (typeof imageId !== "string" || imageId.length === 0) {
    return null;
  }
  return `${endpoint}${imageId}/public`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function positiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function readPreview(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  if (typeof value.title !== "string" || value.title.length === 0) {
    return null;
  }
  if (typeof value.description !== "string" || value.description.length === 0) {
    return null;
  }
  const imageId =
    typeof value.imageId === "string" && value.imageId.length > 0
      ? value.imageId
      : null;
  const imageUrl =
    typeof value.imageUrl === "string" &&
    /^https?:\/\//i.test(value.imageUrl)
      ? value.imageUrl
      : null;
  return {
    title: value.title.replace(/[\r\n]+/g, " ").trim(),
    description: value.description.replace(/[\r\n]+/g, " ").trim(),
    imageId,
    imageUrl,
    width: positiveInteger(value.width),
    height: positiveInteger(value.height),
  };
}

export function injectPreview(html, preview, pageUrl, imageUrl) {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const url = escapeHtml(pageUrl);
  const tags = [
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="SeaSketch" />`,
  ];
  if (imageUrl) {
    const image = escapeHtml(imageUrl);
    tags.push(`<meta property="og:image" content="${image}" />`);
    tags.push(`<meta name="twitter:image" content="${image}" />`);
    if (preview.width && preview.height) {
      tags.push(`<meta property="og:image:width" content="${preview.width}" />`);
      tags.push(
        `<meta property="og:image:height" content="${preview.height}" />`
      );
    }
  }
  tags.push(
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />`
  );
  tags.push(`<meta name="twitter:title" content="${title}" />`);
  tags.push(`<meta name="twitter:description" content="${description}" />`);

  let next = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${title}</title>`
  );
  next = next.replace(
    /<meta\s+name="description"[\s\S]*?content="[^"]*"[\s\S]*?\/?>/,
    `<meta name="description" content="${description}" />`
  );
  return next.replace("</head>", `${tags.join("\n")}\n</head>`);
}

export function previewPageUrl(origin, pathname, target) {
  const path = `${origin}${pathname.replace(/\/$/, "")}`;
  if (target && target.type === "page" && target.kind === "post" && target.postId) {
    return `${path}?post=${target.postId}`;
  }
  return path;
}

export async function loadSharePreview(endpoint, target, fetchImpl = fetch) {
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return null;
  }
  const page = target.type === "page";
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: page ? PAGE_QUERY : BOOKMARK_QUERY,
      variables: page
        ? {
            slug: target.slug,
            kind: target.kind,
            forumId: target.forumId ?? null,
            topicId: target.topicId ?? null,
            postId: target.postId ?? null,
          }
        : { slug: target.slug, id: target.id },
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  const payload = page
    ? body?.data?.pageLinkPreview
    : body?.data?.bookmarkLinkPreview;
  const preview = readPreview(payload);
  if (preview && (preview.title.length === 0 || preview.description.length === 0)) {
    return null;
  }
  return preview;
}
