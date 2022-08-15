import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import Modal from "../../components/Modal";
import Switch from "../../components/Switch";
import {
  DeleteBasemapDocument,
  DeleteBasemapMutation,
  useAllBasemapsQuery,
} from "../../generated/graphql";
import { useDelete } from "../../graphqlHookWrappers";

export default function SelectBasemapsModal(props: {
  value: number[];
  onRequestClose: (value: number[]) => void;
}) {
  const [state, setState] = useState(props.value);

  function updateState(id: number, toggled: boolean) {
    if (toggled && state.indexOf(id) === -1) {
      setState([...state, id]);
    } else {
      setState(state.filter((i) => i !== id));
    }
  }
  const { slug } = useParams<{ slug: string }>();

  const { t } = useTranslation("admin:surveys");
  const { data } = useAllBasemapsQuery({
    fetchPolicy: "cache-and-network",
    variables: {
      slug,
    },
  });
  const deleteBasemap = useDelete<DeleteBasemapMutation>(DeleteBasemapDocument);

  const basemaps = useMemo(() => {
    if (data?.projectBySlug?.basemaps && data.projectBySlug.surveyBasemaps) {
      return {
        project: data.projectBySlug.basemaps,
        survey: data.projectBySlug.surveyBasemaps,
      };
    }
    return {
      project: [],
      survey: [],
    };
  }, [data]);
  return (
    <Modal
      autoWidth
      scrollable
      title={t("Choose basemaps")}
      onRequestClose={() => props.onRequestClose(state)}
      footer={[
        {
          label: t("Done"),
          onClick: () => props.onRequestClose(state),
        },
      ]}
      className=""
    >
      <div className="px-2 space-y-3 w-96 max-w-full">
        {basemaps.survey.length > 0 && (
          <h4 className="text-sm mb-4 text-gray-500 font-semibold">
            <Trans ns="admin:surveys">Project basemaps</Trans>
          </h4>
        )}
        {basemaps.project.map((basemap) => (
          <div key={basemap.id} className="flex items-center space-x-4">
            <img
              src={basemap.thumbnail}
              alt={`${basemap.name} thumbnail`}
              className="w-12 h-12 rounded shadow"
            />
            <div className="flex-1">{basemap.name}</div>
            <Switch
              className=""
              isToggled={state.indexOf(basemap.id) !== -1}
              onClick={(toggled) => updateState(basemap.id, toggled)}
            />
          </div>
        ))}
        {basemaps.survey.length > 0 && (
          <>
            <h4 className="text-sm mb-4 text-gray-500 font-semibold">
              <Trans ns="admin:surveys">Survey basemaps</Trans>
            </h4>
            {basemaps.survey.map((basemap) => (
              <div key={basemap.id} className="flex items-center space-x-4">
                <img
                  src={basemap.thumbnail}
                  alt={`${basemap.name} thumbnail`}
                  className="w-12 h-12 rounded shadow"
                />
                <div className="flex-1 flex-col">
                  <div className="">{basemap.name}</div>
                  {basemap.relatedFormElements &&
                    basemap.relatedFormElements.length === 0 &&
                    state.indexOf(basemap.id) === -1 && (
                      <div className="text-sm italic text-gray-500">
                        <Trans ns="admin:surveys">No related elements.</Trans>
                        &nbsp;
                        <button
                          className="text-primary-500 not-italic underline"
                          onClick={() => {
                            deleteBasemap(basemap);
                          }}
                        >
                          {t("Discard")}
                        </button>
                      </div>
                    )}
                </div>

                <Switch
                  className=""
                  isToggled={state.indexOf(basemap.id) !== -1}
                  onClick={(toggled) => updateState(basemap.id, toggled)}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
