export async function cacheFirst(
  cache: Cache,
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
  cache: Cache,
  cacheKey: string,
  request: Request,
  appendToCache?: boolean
) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      if (appendToCache) {
        cache.put(cacheKey, networkResponse.clone());
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
    const cached = await cache.match(cacheKey);
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
