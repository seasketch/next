import { AnySourceData, Style } from "mapbox-gl";
import { useEffect, useState } from "react";

export async function getSources(styleUrl: string, mapboxApiKey: string) {
  let url = styleUrl;
  if (/^mapbox:/.test(styleUrl)) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [mbox, blank, styles, username, styleId] = styleUrl.split("/");
    // eslint-disable-next-line i18next/no-literal-string
    url = `https://api.mapbox.com/styles/v1/${username}/${styleId}?access_token=${mapboxApiKey}`;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error((await response.json()).message);
  } else {
    const style: Style = await response.json();
    return Object.values(style.sources);
  }
}

export function useStyleSources(styleUrl: string, mapboxApiKey: string) {
  const [state, setState] = useState<{
    sources?: AnySourceData[];
    loading: boolean;
    error?: string;
  }>({
    loading: true,
  });
  useEffect(() => {
    setState({ loading: true });
    getSources(styleUrl, mapboxApiKey)
      .then((sources) => {
        setState({
          loading: false,
          sources,
        });
      })
      .catch((e) => {
        setState({ loading: false, error: e.toString() });
      });
  }, [mapboxApiKey, styleUrl]);
  return state;
}
