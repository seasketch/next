export async function cacheFirst(
  cache: Cache | CacheLike,
  cacheKey: string,
  request: Request,
  appendToCache?: boolean
) {
  const response = await cache.match(cacheKey);
  if (response && response.ok) {
    return response;
  } else {
    try {
      const networkResponse = await fetch(request);
      if (appendToCache && networkResponse.ok) {
        cache.put(cacheKey, networkResponse.clone());
      }
      return networkResponse;
    } catch (e) {
      console.error(e);
      return new Response("cacheFirst strategy failed to resolve request", {
        status: 408,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
}

export async function networkFirst(
  cache: Cache | CacheLike,
  cacheKey: string,
  request: Request,
  appendToCache?: boolean,
  timeout?: number,
  expectedContentType?: RegExp
) {
  const cached = await cache.match(cacheKey);
  const abortController = new AbortController();
  let timeoutRef: any;
  if (timeout && cached) {
    timeoutRef = setTimeout(() => {
      console.warn("service-worker: aborting request due to timeout");
      abortController.abort();
    }, timeout);
  }
  try {
    const networkResponse = await fetch(request, {
      signal: abortController.signal,
    });
    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }
    if (networkResponse.ok) {
      if (appendToCache && networkResponse.status !== 204) {
        if (
          !expectedContentType ||
          expectedContentType.test(
            networkResponse.headers.get("content-type") || ""
          )
        ) {
          cache.put(cacheKey, networkResponse.clone());
        }
      } else if (networkResponse.status === 204) {
        console.warn(
          "204 response from networkFirst strategy, skipping caching"
        );
      }
      return networkResponse;
    } else {
      const response = await cache.match(cacheKey);
      if (response && response.ok) {
        return response;
      } else if (networkResponse) {
        return networkResponse;
      } else if (response) {
        return response;
      } else {
        throw new Error("No cache");
      }
    }
  } catch (e) {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
    }
    if (cached) {
      return cached;
    } else {
      return new Response("networkFirst strategy failed to resolve request", {
        status: 408,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
}

export type CacheLike = {
  match: (cacheKey: string) => Promise<Response | undefined>;
  put: (cacheKey: string, response: Response) => void;
};
