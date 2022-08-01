export async function handler(event: FetchEvent): Promise<Response> {
  return match(event.request).then((r) => {
    if (r) {
      return r;
    } else {
      if (
        /consentDocs/.test(event.request.url.toString()) &&
        process.env.REACT_APP_CLOUDFRONT_DOCS_DISTRO
      ) {
        // eslint-disable-next-line i18next/no-literal-string
        const url = `https://${
          process.env.REACT_APP_CLOUDFRONT_DOCS_DISTRO
        }.cloudfront.net${new URL(event.request.url).pathname}`;
        return fetch(url);
      } else {
        return fetch(event.request.url);
      }
    }
  });
}

/**
 * Like caches.match, but only looks in offline survey caches
 * @param request
 * @returns Response | undefined
 */
export async function match(request: Request | string) {
  if (typeof request === "string") {
    request = new Request(request);
  }
  const keys = (await caches.keys()).filter((key) =>
    /offline-surveys/.test(key)
  );
  for (const key of keys) {
    const cache = await caches.open(key);
    const match = await cache.match(request);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function cacheName(slug: string) {
  // eslint-disable-next-line i18next/no-literal-string
  return `${slug}-offline-surveys`;
}

export function deleteCache(slug: string) {
  return caches.delete(cacheName(slug));
}

export function open(slug: string) {
  return caches.open(cacheName(slug));
}
