import { Style } from "mapbox-gl";
import { useCallback, useEffect, useState } from "react";
import { useMapboxKeysQuery } from "../../generated/graphql";

interface State {
  styles?: (Style & {
    image: string;
    url: string;
    id: string;
    lastModified: Date;
  })[];
  error?: string;
  loading: boolean;
}

export default function useMapboxAccountStyles() {
  const { data, loading, error } = useMapboxKeysQuery();
  const [state, setState] = useState<State>({ loading: true });
  useEffect(() => {
    if (!loading && !data?.currentProject?.mapboxSecretKey) {
      setState({
        error: "MapBox Secret Key not provided",
        loading: false,
      });
    } else if (loading) {
      setState((prev) => ({ ...prev, loading: true }));
    }
  }, [data?.currentProject?.mapboxSecretKey, loading]);

  const fetchData = useCallback(
    function fetchData(
      url: string,
      username: string,
      key: string,
      publicKey: string
    ) {
      fetch(url, {
        headers: {
          "Cache-Control": "max-age=300",
        },
      })
        .then(async (response) => {
          let next = response.headers.get("Link");
          if (next) {
            const match = next.match(/<(.*)>/);
            if (match) {
              next = match[1];
            } else {
              next = null;
            }
          }
          const data = await response.json();
          setState((prev) => ({
            loading: false,
            styles: [
              ...(prev.styles || []),
              ...data.map((d: any) => ({
                ...d,
                image: `https://api.mapbox.com/styles/v1/seasketch/${d.id}/static/auto/100x100@2x?attribution=false&logo=false&access_token=${publicKey}`,
                url: `mapbox://styles/${username}/${d.id}`,
                lastModified: d.modified
                  ? new Date(d.modified)
                  : new Date(d.created),
              })),
            ],
            hasMore: next,
          }));
          if (next) {
            fetchData(`${next}&access_token=${key}`, username, key, publicKey);
          }
        })
        .catch((e) => setState((prev) => ({ ...prev, error: e.toString() })));
    },
    [setState]
  );

  useEffect(() => {
    if (data?.currentProject?.mapboxSecretKey) {
      const key = data?.currentProject?.mapboxSecretKey;
      const publicKey =
        data?.currentProject?.mapboxPublicKey ||
        process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
      const { u: username } = JSON.parse(
        atob(key.replace(/sk\./, "").split(".")[0])
      );
      fetchData(
        // eslint-disable-next-line i18next/no-literal-string
        `https://api.mapbox.com/styles/v1/${username}?sortby=modified&limit=100&draft=false&access_token=${key}`,
        username,
        key,
        publicKey!
      );
    }
  }, [data?.currentProject?.mapboxSecretKey]);

  return state;
}
