import { CameraOptions } from "mapbox-gl";
import MiniBasemapSelector from "../admin/data/MiniBasemapSelector";
import useMapEssentials from "../admin/surveys/useMapEssentials";
import MapboxMap from "../components/MapboxMap";
import { SurveyMapPortal } from "../formElements/FormElement";

export default function SurveyContextualMap(props: {
  basemaps: number[];
  cameraOptions?: CameraOptions;
}) {
  const { basemaps, mapContext, bounds } = useMapEssentials({
    filterBasemapIds: props.basemaps,
    cameraOptions: props.cameraOptions,
  });
  return (
    <SurveyMapPortal mapContext={mapContext}>
      {basemaps.length > 1 && <MiniBasemapSelector basemaps={basemaps} right />}
      <MapboxMap className="w-full h-full" showNavigationControls={true} />
    </SurveyMapPortal>
  );
}
