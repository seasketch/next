import { Style as MapboxStyle } from "mapbox-gl";
import { useEffect, useState } from "react";
import { InteractivitySetting } from "./generated/graphql";

const TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

interface Style extends MapboxStyle {
  metadata?: {
    "seasketch:interactivity_settings"?: Pick<
      InteractivitySetting,
      "cursor" | "layers" | "longTemplate" | "shortTemplate" | "type"
    >;
  };
}

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
  if (id in fetchedStyles) {
    return fetchedStyles[id];
  } else {
    let Url = new URL(url);
    if (Url.protocol === "mapbox:") {
      const sources = Url.pathname.replace("//", "");
      Url = new URL(
        // eslint-disable-next-line i18next/no-literal-string
        `https://api.mapbox.com/styles/v1/${
          url.split("mapbox://styles/")[1]
        }?access_token=${TOKEN}`
      );
    }
    // Indicate to service-worker that this request should served from cache if available
    Url.searchParams.set("ssn-tr", "true");
    fetchedStyles[id] = fetch(Url.toString())
      .then((res) => res.json())
      .then((style) => {
        if (style.version && style.sources) {
          return style as Style;
        } else {
          throw new Error(
            // eslint-disable-next-line
            `Content at ${url} does not appear to be a Mapbox GL Style`
          );
        }
      });
    return fetchedStyles[id];
  }
}

export { useMapboxStyle, fetchGlStyle };
