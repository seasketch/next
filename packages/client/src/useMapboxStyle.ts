import { Style } from "mapbox-gl";
import { useEffect, useState } from "react";

const TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

function useMapboxStyle(styleUrl?: string) {
  const [state, setState] = useState<{
    data?: Style;
    loading: boolean;
    error?: Error;
  }>({ loading: false });
  useEffect(() => {
    let cancelled = false;
    setState({
      loading: true,
    });
    if (styleUrl) {
      const style = fetchGlStyle(styleUrl)
        .then((style) => {
          if (!cancelled) {
            setState({
              loading: false,
              data: style,
            });
          }
        })
        .catch((error) => {
          if (!cancelled) setState({ loading: false, error });
        });
    } else {
      setState({ loading: false });
    }
    return () => {
      cancelled = true;
    };
  }, [styleUrl]);
  return state;
}

const fetchedStyles: { [url: string]: Promise<Style> } = {};

async function fetchGlStyle(url: string) {
  const id = url;
  if (fetchedStyles[id]) {
    return fetchedStyles[id];
  } else {
    const originalUrl = url;
    if (/mapbox:\/\//.test(url)) {
      url = `https://api.mapbox.com/styles/v1/${
        url.split("mapbox://styles/")[1]
      }?access_token=${TOKEN}`;
    }
    fetchedStyles[id] = fetch(url)
      .then((res) => res.json())
      .then((style) => {
        if (style.version && style.sources) {
          return style as Style;
        } else {
          throw new Error(
            `Content at ${originalUrl} does not appear to be a Mapbox GL Style`
          );
        }
      });
    return fetchedStyles[id];
  }
}

export { useMapboxStyle, fetchGlStyle };
