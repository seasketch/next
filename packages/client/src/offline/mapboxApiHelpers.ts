import { Style } from "mapbox-gl";

const cachedStyles: { [url: string]: Style } = {};

export async function getStyle(
  styleUrl: string,
  mapboxApiKey: string,
  abortController?: AbortController
) {
  const url = normalizeStyleUrl(styleUrl, mapboxApiKey);
  if (cachedStyles[url]) {
    return cachedStyles[url];
  } else {
    const response = await fetch(url, {
      signal: abortController?.signal,
    });
    if (!response.ok) {
      throw new Error((await response.json()).message);
    } else {
      const style: Style = await response.json();
      cachedStyles[url] = style;
      return cachedStyles[url];
    }
  }
}

export function normalizeStyleUrl(styleUrl: string, mapboxApiKey: string) {
  let url = styleUrl;
  if (/^mapbox:/.test(styleUrl)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [mbox, blank, styles, username, styleId] = styleUrl.split("/");
    // eslint-disable-next-line i18next/no-literal-string
    url = `https://api.mapbox.com/styles/v1/${username}/${styleId}?access_token=${mapboxApiKey}`;
  }
  return url;
}

export function normalizeSourceUrlTemplate(
  sourceUrl: string,
  sourceType: "raster" | "raster-dem" | "vector"
) {
  let url = sourceUrl;
  if (/^mapbox:/.test(sourceUrl)) {
    const sourceList = sourceUrl.replace("mapbox://", "");
    switch (sourceType) {
      case "vector":
        // eslint-disable-next-line i18next/no-literal-string
        url = `https://api.mapbox.com/v4/${sourceList}/{z}/{x}/{y}.vector.pbf`;
        break;
      case "raster":
        // eslint-disable-next-line i18next/no-literal-string
        url = `https://api.mapbox.com/v4/${sourceList}/{z}/{x}/{y}@2x.webp`;
        break;
      case "raster-dem":
        // eslint-disable-next-line i18next/no-literal-string
        url = `https://api.mapbox.com/raster/v1/${sourceList}/{z}/{x}/{y}.webp`;
        break;
      default:
        break;
    }
  }
  return url;
}
