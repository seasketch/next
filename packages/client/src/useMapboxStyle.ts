import { Style as MapboxStyle } from "mapbox-gl";
import { useEffect, useState } from "react";
import { InteractivitySetting } from "./generated/graphql";

const MAPBOX_GL_MISSING_TOKEN =
  "An API access token is required to use Mapbox GL";

/**
 * Thrown when a Mapbox-hosted style, font, sprite, or tile would be requested
 * and `REACT_APP_MAPBOX_ACCESS_TOKEN` is unset. The request is skipped.
 */
export class MissingMapboxAccessTokenError extends Error {
  constructor() {
    super(
      // eslint-disable-next-line i18next/no-literal-string -- logged, not shown in the UI
      "Mapbox access token is not configured"
    );
    this.name = "MissingMapboxAccessTokenError";
  }
}

export function mapboxAccessToken(): string {
  const token = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  return typeof token === "string" ? token.trim() : "";
}

export function hasMapboxAccessToken(): boolean {
  return mapboxAccessToken().length > 0;
}

export function isMissingMapboxAccessTokenError(error: unknown): boolean {
  if (error instanceof MissingMapboxAccessTokenError) {
    return true;
  }
  return (
    error instanceof Error && error.message.includes(MAPBOX_GL_MISSING_TOKEN)
  );
}

export function mapLoadFailureKind(
  error: unknown
): "webgl" | "missing-token" | "unavailable" {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Failed to initialize WebGL")) {
    return "webgl";
  }
  if (isMissingMapboxAccessTokenError(error)) {
    return "missing-token";
  }
  return "unavailable";
}

/**
 * A hosted Mapbox style can only replace a failed basemap when a token is set.
 * Without one, the fallback request fails the same way as the original.
 */
export function shouldAttemptMapboxStyleFallback(error: unknown): boolean {
  return hasMapboxAccessToken() && !isMissingMapboxAccessTokenError(error);
}

function isMapboxResourceUrl(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("mapbox:") ||
      value.includes("api.mapbox.com") ||
      value.includes("api.mapbox.cn"))
  );
}

/**
 * True when constructing a map from this style would request Mapbox hosting.
 * Raster basemaps built in the client still point glyphs and sprites there.
 */
export function styleReferencesMapbox(style: {
  glyphs?: unknown;
  sprite?: unknown;
  sources?: unknown;
}): boolean {
  if (isMapboxResourceUrl(style.glyphs) || isMapboxResourceUrl(style.sprite)) {
    return true;
  }
  if (!style.sources || typeof style.sources !== "object") {
    return false;
  }
  for (const source of Object.values(style.sources)) {
    if (!source || typeof source !== "object") {
      continue;
    }
    if ("url" in source && isMapboxResourceUrl(source.url)) {
      return true;
    }
    if (
      "tiles" in source &&
      Array.isArray(source.tiles) &&
      source.tiles.some((tile: unknown) => isMapboxResourceUrl(tile))
    ) {
      return true;
    }
  }
  return false;
}

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
      const token = mapboxAccessToken();
      if (!token) {
        throw new MissingMapboxAccessTokenError();
      }
      Url = new URL(
        // eslint-disable-next-line i18next/no-literal-string
        `https://api.mapbox.com/styles/v1/${
          url.split("mapbox://styles/")[1]
        }?access_token=${token}`
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
