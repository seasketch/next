import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { useEffect, useMemo, useState } from "react";
import Switch from "../../components/Switch";
import {
  useEezLayerQuery,
  UserProfileDetailsFragment,
  useUpdateLandClippingSettingsMutation,
} from "../../generated/graphql";
import getSlug from "../../getSlug";
import InlineAuthorDetails from "../../projects/Forums/InlineAuthorDetails";
import InlineAuthor from "../../components/InlineAuthor";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import Select from "react-select";

export default function EEZClippingModal({
  onRequestClose,
  enabled,
  lastUpdated,
  author,
  selectedEEZs,
}: {
  onRequestClose: () => void;
  enabled: boolean;
  lastUpdated: Date;
  author: UserProfileDetailsFragment;
  selectedEEZs?: string[];
}) {
  const { t } = useTranslation("admin:geography");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useEezLayerQuery({ onError });
  const [state, setState] = useState<{
    enabled: boolean;
    selectedEEZs: string[];
    hasChanges: boolean;
  }>({ enabled, selectedEEZs: selectedEEZs || [], hasChanges: false });
  const [mutation, mutationState] = useUpdateLandClippingSettingsMutation();

  const [eezChoices, setEezChoices] = useState<
    { label: string; value: number }[]
  >([]);

  console.log(eezChoices, "eezChoices"); // for debugging

  useEffect(() => {
    if (data?.eezlayer?.dataLayer?.dataSource?.url) {
      const sourceUrl = data.eezlayer.dataLayer.dataSource.url;
      // eslint-disable-next-line i18next/no-literal-string
      const url = `https://overlay.seasketch.org/properties?include=MRGID_EEZ,UNION,POL_TYPE,SOVEREIGN1&dataset=${sourceUrl
        .split("/")
        .slice(3)
        .join("/")}.fgb`;
      console.log("fetching eez choices from: ", url);
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
            json: { MRGID_EEZ: number; SOVEREIGN1: string; UNION: string }[]
          ) => {
            if (json && json.length) {
              const choices = json
                .sort((a, b) => a.SOVEREIGN1.localeCompare(b.SOVEREIGN1)) // sort by MRGID_EEZ
                .map((props) => {
                  let label = `${props.MRGID_EEZ} - ${props.UNION}`;
                  if (props.UNION !== props.SOVEREIGN1) {
                    label += `, ${props.SOVEREIGN1}`;
                  }
                  return {
                    label,
                    value: props.MRGID_EEZ,
                  };
                })
                .filter((choice: any) => choice.label && choice.value); // filter out empty labels/values
              setEezChoices(choices);
            }
          }
        )
        .catch((error) => {
          // handle fetch error
          console.error("Error fetching EEZ choices: ", error);
          onError(
            new Error(
              `Failed to fetch EEZ choices from ${data?.eezlayer?.dataLayer?.dataSource?.url}: ${error.message}`
            )
          );
          setEezChoices([]); // reset choices on error
        });
    } else {
      setEezChoices([]); // reset choices if no url
    }
  }, [data?.eezlayer?.dataLayer?.dataSource?.url]);

  return (
    <Modal
      disableBackdropClick={mutationState.loading || state.hasChanges}
      title={t("Exclusive Economic Zone (EEZ) Clipping")}
      onRequestClose={onRequestClose}
      footer={[
        {
          label: t("Cancel"),
          disabled: mutationState.loading,
          onClick: onRequestClose,
        },
        {
          label: t("Save"),
          variant: "primary",
          disabled: mutationState.loading || state.hasChanges,
          loading: mutationState.loading,
          onClick: async () => {
            // save state
            // await mutation({
            //   variables: { enable: state, slug: getSlug() },
            // });
            onRequestClose();
          },
        },
      ]}
    >
      <p className="text-sm w-full flex items-center space-x-4 pb-5 pt-1">
        <Switch
          disabled={!Boolean(selectedEEZs?.length)}
          isToggled={state.enabled}
          onClick={(val) =>
            setState((prev) => ({
              ...prev,
              enabled: val,
              hasChanges: true, // enable save button
            }))
          }
        />
        <label>{t("Limit to the chosen EEZ(s)")}</label>
      </p>
      <select
        multiple
        value={state.selectedEEZs}
        onChange={(e) => {
          const options = Array.from(
            e.target.selectedOptions
          ) as HTMLOptionElement[];
          const selectedValues = options.map((option) => option.value);
          setState((prev) => ({
            ...prev,
            selectedEEZs: selectedValues,
            hasChanges: true, // enable save button
          }));
        }}
        className={`w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
          state.enabled ? "" : "opacity-50 cursor-not-allowed"
        }`}
        disabled={!state.enabled || eezChoices.length === 0}
      >
        {eezChoices.map(({ label, value }) => (
          <option
            key={value}
            value={value}
            className="p-2"
            selected={state.selectedEEZs.includes(value.toString())}
          >
            {label}
          </option>
        ))}
      </select>

      <p className="text-sm">
        <Trans ns="admin:geography">
          SeaSketch maintains a copy of the{" "}
          <a
            target="_blank"
            className="underline"
            href="https://daylightmap.org/coastlines.html"
          >
            MarineRegions EEZ dataset
          </a>{" "}
          which can be used to limit the planning units to those within the
          chosen Exclusive Economic Zones (EEZs).
        </Trans>
      </p>
      <p className="flex items-center py-2 text-sm space-x-2">
        <span>
          <Trans ns="admin:geography">
            Layer last updated {lastUpdated.toLocaleDateString()} by{" "}
          </Trans>
        </span>
        <InlineAuthor profile={author} />
      </p>
    </Modal>
  );
}
