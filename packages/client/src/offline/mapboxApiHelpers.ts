import { AnySourceData, Style } from "mapbox-gl";
import { useEffect, useState } from "react";

const cachedSources: { [url: string]: AnySourceData[] } = {};

export async function getSources(
  styleUrl: string,
  mapboxApiKey: string,
  abortController?: AbortController
) {
  let url = styleUrl;
  if (/^mapbox:/.test(styleUrl)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [mbox, blank, styles, username, styleId] = styleUrl.split("/");
    // eslint-disable-next-line i18next/no-literal-string
    url = `https://api.mapbox.com/styles/v1/${username}/${styleId}?access_token=${mapboxApiKey}`;
  }
  if (cachedSources[url]) {
    return cachedSources[url];
  } else {
    const response = await fetch(url, {
      signal: abortController?.signal,
    });
    if (!response.ok) {
      throw new Error((await response.json()).message);
    } else {
      const style: Style = await response.json();
      cachedSources[url] = Object.values(style.sources);
      return cachedSources[url];
    }
  }
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
