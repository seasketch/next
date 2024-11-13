import { Trans, useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { GeostatsAttribute } from "@seasketch/geostats-types";
import { useEffect, useState } from "react";
import Warning from "../../components/Warning";

export default function EvaluateFilterServiceModal(props: {
  location: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:sketching");
  const [state, setState] = useState({
    loading: true,
    attributes: [] as GeostatsAttribute[],
    version: 0,
    error: null as Error | null,
    featureCount: 0,
  });

  useEffect(() => {
    if (props.location) {
      setState({
        loading: true,
        attributes: [],
        version: 0,
        error: null,
        featureCount: 0,
      });
      const abortController = new AbortController();
      fetch(`${props.location.replace(/\/$/, "")}/metadata`, {
        signal: abortController.signal,
      })
        .then(async (res) => {
          if (res.ok) {
            const json = await res.json();
            if (!json.version) {
              throw new Error(
                "Invalid response from filter service. Missing version."
              );
            }
            if (!json.attributes) {
              throw new Error(
                "Invalid response from filter service. Missing attributes."
              );
            }
            if (!Array.isArray(json.attributes)) {
              throw new Error(
                "Invalid response from filter service. Attributes must be an array."
              );
            }
            const firstAttr = json.attributes[0];
            if (
              !firstAttr.attribute ||
              typeof firstAttr.attribute !== "string"
            ) {
              throw new Error(
                "Invalid response from filter service. Attribute.attribute must be a string."
              );
            }
            setState({
              loading: true,
              attributes: json.attributes,
              version: json.version,
              error: null,
              featureCount: 0,
            });
            // next, count features
            fetch(`${props.location.replace(/\/$/, "")}/count`, {
              signal: abortController.signal,
            })
              .then(async (res) => {
                if (res.ok) {
                  const json = await res.json();
                  setState((prev) => {
                    return {
                      ...prev,
                      featureCount: json.count,
                      loading: false,
                    };
                  });
                } else {
                  setState({
                    loading: false,
                    attributes: [],
                    version: 0,
                    error: new Error(await res.text()),
                    featureCount: 0,
                  });
                }
              })
              .catch((err) => {
                if (err.name !== "AbortError") {
                  setState({
                    loading: false,
                    attributes: [],
                    version: 0,
                    error: err,
                    featureCount: 0,
                  });
                }
              });
          } else {
            setState({
              loading: false,
              attributes: [],
              version: 0,
              error: new Error(await res.text()),
              featureCount: 0,
            });
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setState({
              loading: false,
              attributes: [],
              version: 0,
              error: err,
              featureCount: 0,
            });
          }
        });
      return () => {
        abortController.abort();
      };
    }
  }, [props.location]);

  return (
    <Modal
      loading={state.loading}
      onRequestClose={props.onRequestClose}
      title={t("Evaluate Filter Service")}
    >
      {state.error ? (
        <Warning level="error">{state.error.message}</Warning>
      ) : (
        <div>
          <p>
            <Trans ns="admin:sketching">
              This filter service is on version {{ version: state.version }} and
              currently contains{" "}
              {{ featureCount: state.featureCount.toLocaleString() }} features,
              with the following attributes available for filtering:
            </Trans>
          </p>

          <div className="max-h-64 overflow-y-auto p-2 border">
            <ul>
              {state.attributes.map((attr) => (
                <li key={attr.attribute}>
                  <strong>{attr.attribute}</strong> ({attr.type})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
