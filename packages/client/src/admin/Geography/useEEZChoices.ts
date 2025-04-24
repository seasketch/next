import { useEffect, useState } from "react";
import { useEezLayerQuery } from "../../generated/graphql";

type EEZProps = {
  MRGID_EEZ: number;
  SOVEREIGN1?: string;
  UNION: string;
  bbox: number[];
};

export default function useEEZChoices() {
  const { data, loading } = useEezLayerQuery({
    onError: (e) => {
      setState((prev) => ({
        ...prev,
        error: e,
      }));
    },
  });

  const [state, setState] = useState<{
    loading: boolean;
    error?: Error;
    dataLayerId?: number;
    data: { label: string; value: number; data: EEZProps }[];
  }>({
    loading: true,
    data: [],
  });

  useEffect(() => {
    if (data?.eezlayer?.dataLayer?.dataSource?.url) {
      const sourceUrl = data.eezlayer.dataLayer.dataSource.url;
      // eslint-disable-next-line i18next/no-literal-string
      const url = `https://overlay.seasketch.org/properties?include=MRGID_EEZ,UNION,POL_TYPE,SOVEREIGN1&bbox=true&dataset=${sourceUrl
        .split("/")
        .slice(3)
        .join("/")}.fgb&v=3`;
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to fetch EEZ choices from ${url}: ${response.statusText}`
            );
          }
          return response.json();
        })
        .then((json: EEZProps[]) => {
          if (json && json.length) {
            const choices = json
              .sort((a, b) =>
                (a.SOVEREIGN1 || "").localeCompare(b.SOVEREIGN1 || "")
              ) // sort by MRGID_EEZ
              .map((props) => {
                return {
                  label: labelForEEZ(props),
                  value: props.MRGID_EEZ,
                  data: props,
                };
              })
              .filter((choice: any) => choice.label && choice.value); // filter out empty labels/values
            setState({
              loading: false,
              data: choices,
              dataLayerId: data.eezlayer?.dataLayer?.id || undefined,
            });
          }
        })
        .catch((error) => {
          // handle fetch error
          console.error("Error fetching EEZ choices: ", error);
          setState({
            loading: false,
            error: new Error(
              `Failed to fetch EEZ choices from ${data?.eezlayer?.dataLayer?.dataSource?.url}: ${error.message}`
            ),
            data: [],
          });
        });
    }
  }, [data?.eezlayer?.dataLayer?.dataSource?.url]);

  return state;
}

export function labelForEEZ(props: EEZProps): string {
  let label = `${props.UNION || props.SOVEREIGN1}`;
  // if (props.SOVEREIGN1 && props.UNION !== props.SOVEREIGN1) {
  //   label += ` - ${props.UNION}`;
  // }
  return label;
}
