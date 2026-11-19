/**
 * Link previews for layer links and map bookmarks.
 *
 * Slack, Facebook, X, iMessage, and the rest read Open Graph tags from the
 * first HTML response. They do not run the React app, so the worker inserts
 * the tags when one of those crawlers requests a share URL.
 */

const SHARE_PATH =
  /^\/([^/]+)\/(layers|bookmarks)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i;

const PREVIEW_BOT =
  /Slackbot|Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Discordbot|WhatsApp|TelegramBot|Applebot|redditbot|Embedly|Iframely|Pinterest|vkShare|SkypeUriPreview|Googlebot|bingbot|DuckDuckBot/i;

const PREVIEW_QUERY = `query BookmarkLinkPreview($slug: String!, $id: UUID!) {
  bookmarkLinkPreview(slug: $slug, id: $id)
}`;

export function shareTarget(pathname) {
  const match = SHARE_PATH.exec(pathname);
  if (!match) {
    return null;
  }
  return { slug: match[1], id: match[3] };
}

export function isPreviewBot(userAgent) {
  return typeof userAgent === "string" && PREVIEW_BOT.test(userAgent);
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
  const imageId = typeof value.imageId === "string" ? value.imageId : null;
  return {
    title: value.title,
    description: value.description,
    imageId,
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

export async function loadSharePreview(endpoint, target, fetchImpl = fetch) {
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return null;
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query: PREVIEW_QUERY,
      variables: { slug: target.slug, id: target.id },
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    return null;
  }
  const body = await response.json();
  return readPreview(body?.data?.bookmarkLinkPreview);
}
