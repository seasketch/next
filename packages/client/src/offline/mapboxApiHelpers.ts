import { AnySourceData, Style } from "mapbox-gl";
import { useEffect, useState } from "react";

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
        throw new Error("raster-dem Unsuppored");
      default:
        break;
    }
  }
  return url;
}

export async function getSources(
  styleUrl: string,
  mapboxApiKey: string,
  abortController?: AbortController
) {
  return Object.values(
    (await getStyle(styleUrl, mapboxApiKey, abortController)).sources
  );
}

export function useStyleSources(
  styleUrl: string | null | undefined,
  mapboxApiKey: string
) {
  const [state, setState] = useState<{
    sources?: AnySourceData[];
    loading: boolean;
    error?: string;
  }>({
    loading: true,
  });
  useEffect(() => {
    const ac = new AbortController();
    if (!styleUrl) {
      setState({ loading: false, sources: [] });
    } else {
      setState({ loading: true });
      getSources(styleUrl, mapboxApiKey, ac)
        .then((sources) => {
          if (!ac.signal.aborted) {
            setState({
              loading: false,
              sources,
            });
          }
        })
        .catch((e) => {
          if (!ac.signal.aborted) {
            setState({ loading: false, error: e.toString() });
          }
        });
    }
    return () => {
      ac.abort();
    };
  }, [mapboxApiKey, styleUrl]);
  return state;
}
