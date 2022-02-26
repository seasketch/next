import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import Button from "../../components/Button";
import Modal from "../../components/Modal";
import Switch from "../../components/Switch";
import { useGetBasemapsQuery } from "../../generated/graphql";

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

  const { t } = useTranslation("admin:surveys");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      slug,
    },
  });
  return (
    <Modal
      open={true}
      title={t("Choose basemaps")}
      onRequestClose={() => props.onRequestClose(state)}
      footer={
        <div className="flex justify-end">
          <Button
            label={t("Done")}
            onClick={() => props.onRequestClose(state)}
          />
        </div>
      }
    >
      <div className="px-2 space-y-3">
        {/* <h4 className="text-sm mb-4 text-gray-500 font-semibold">
          <Trans ns="admin:surveys">Project basemaps</Trans>
        </h4> */}
        {(data?.projectBySlug?.basemaps || []).map((basemap) => (
          <div key={basemap.id} className="flex items-center space-x-4">
            <img src={basemap.thumbnail} className="w-12 h-12 rounded shadow" />
            <div className="flex-1">{basemap.name}</div>
            <Switch
              className=""
              isToggled={state.indexOf(basemap.id) !== -1}
              onClick={(toggled) => updateState(basemap.id, toggled)}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
