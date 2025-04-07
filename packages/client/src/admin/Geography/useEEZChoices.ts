import { useEffect, useState } from "react";
import { useEezLayerQuery } from "../../generated/graphql";

type EEZProps = { MRGID_EEZ: number; SOVEREIGN1?: string; UNION: string };

export default function useEEZChoices(): {
  loading: boolean;
  error?: Error;
  data: { label: string; value: number; data: EEZProps }[];
} {
  const { data, loading } = useEezLayerQuery({
    onError: (e) => {
      setState({
        loading: false,
        error: e,
        data: [],
      });
    },
  });

  const [state, setState] = useState<{
    loading: boolean;
    error?: Error;
    data: { label: string; value: number; data: EEZProps }[];
  }>({
    loading: true,
    data: [],
  });

  useEffect(() => {
    if (data?.eezlayer?.dataLayer?.dataSource?.url) {
      setState({ loading: true, data: [] });
      const sourceUrl = data.eezlayer.dataLayer.dataSource.url;
      // eslint-disable-next-line i18next/no-literal-string
      const url = `https://overlay.seasketch.org/properties?include=MRGID_EEZ,UNION,POL_TYPE,SOVEREIGN1&dataset=${sourceUrl
        .split("/")
        .slice(3)
        .join("/")}.fgb`;
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to fetch EEZ choices from ${url}: ${response.statusText}`
            );
          }
          return response.json();
        })
        .then(
          (
            json: { MRGID_EEZ: number; SOVEREIGN1?: string; UNION: string }[]
          ) => {
            if (json && json.length) {
              const choices = json
                .sort((a, b) =>
                  (a.SOVEREIGN1 || "").localeCompare(b.SOVEREIGN1 || "")
                ) // sort by MRGID_EEZ
                .map((props) => {
                  return {
                    label: labelForEEZ(props),
                    value: props.MRGID_EEZ,
                  };
                })
                .filter((choice: any) => choice.label && choice.value); // filter out empty labels/values
              setState({
                loading: false,
                data: choices.map((choice) => ({
                  ...choice,
                  data: json.find((j) => j.MRGID_EEZ === choice.value)!,
                })),
              });
            }
          }
        )
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
    } else {
      setState({
        loading: false,
        data: [],
      });
    }
  }, [data?.eezlayer?.dataLayer?.dataSource?.url]);

  return state;
}

export function labelForEEZ(props: EEZProps): string {
  let label = `${props.SOVEREIGN1 || props.UNION}`;
  if (props.SOVEREIGN1 && props.UNION !== props.SOVEREIGN1) {
    label += ` - ${props.UNION}`;
  }
  return label;
}
