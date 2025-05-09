import { useEffect, useState } from "react";

export type FeatureChoice = {
  label: string;
  value: number;
  data: any;
};

export type FeatureChoicesOptions = {
  idProperty: string;
  labelProperty?: string;
  customLabelFn?: (props: any) => string;
  includeProperties: string[];
  dataset?: string;
};

export type FeatureChoicesState = {
  loading: boolean;
  error?: Error;
  choices: FeatureChoice[];
};

export default function useFeatureChoices(options: FeatureChoicesOptions) {
  const [state, setState] = useState<FeatureChoicesState>({
    loading: true,
    choices: [],
  });

  useEffect(() => {
    const queryParams = new URLSearchParams();
    queryParams.append("include", options.includeProperties.join(","));
    queryParams.append("bbox", "true");
    if (options.dataset) {
      queryParams.append("dataset", options.dataset);
    }
    // eslint-disable-next-line i18next/no-literal-string
    const url = `https://overlay.seasketch.org/properties?${queryParams.toString()}`;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch feature choices from ${url}: ${response.statusText}`
          );
        }
        return response.json();
      })
      .then((json: any[]) => {
        if (json && json.length) {
          const choices = json
            .map((props) => {
              const label = options.customLabelFn
                ? options.customLabelFn(props)
                : props[options.labelProperty || options.idProperty];
              return {
                label,
                value: props[options.idProperty],
                data: props,
              };
            })
            .filter((choice) => choice.label && choice.value);
          setState({
            loading: false,
            choices,
          });
        }
      })
      .catch((error) => {
        console.error("Error fetching feature choices: ", error);
        setState({
          loading: false,
          error: new Error(
            `Failed to fetch feature choices from ${url}: ${error.message}`
          ),
          choices: [],
        });
      });
  }, [options.dataset]);

  return state;
}
