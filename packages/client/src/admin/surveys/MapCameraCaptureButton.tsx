import { CameraIcon } from "@heroicons/react/outline";
import { CameraOptions, Map } from "mapbox-gl";
import { Trans } from "react-i18next";
import Spinner from "../../components/Spinner";

interface Props {
  onClick?: (value: CameraOptions) => void;
  map?: Map;
  saving?: boolean;
}

export default function MapCameraCaptureButton({
  onClick,
  map,
  saving,
}: Props) {
  return (
    <button
      onClick={() => {
        if (map && onClick) {
          onClick({
            center: map.getCenter(),
            bearing: map.getBearing(),
            zoom: map.getZoom(),
            pitch: map.getPitch(),
          });
        }
      }}
      className="bg-yellow-300 border border-black text-black rounded p-2 absolute z-50 bottom-4 left-4 flex items-center"
    >
      {saving ? <Spinner /> : <CameraIcon className="w-5 h-5 inline mr-2" />}
      <Trans ns="admin:surveys">Set Starting Camera</Trans>
    </button>
  );
}
