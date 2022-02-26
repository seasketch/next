import { CameraOptions, FreeCameraOptions } from "mapbox-gl";
import MiniBasemapSelector from "../admin/data/MiniBasemapSelector";
import MapCameraCaptureButton from "../admin/surveys/MapCameraCaptureButton";
import useMapEssentials from "../admin/surveys/useMapEssentials";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import MapboxMap from "../components/MapboxMap";
import { SurveyMapPortal } from "../formElements/FormElement";
import { useUpdateFormElementMapCameraMutation } from "../generated/graphql";

export default function SurveyContextualMap(props: {
  basemaps: number[];
  cameraOptions?: CameraOptions;
  admin?: boolean;
  formElementId?: number;
}) {
  const { basemaps, mapContext, bounds } = useMapEssentials({
    filterBasemapIds: props.basemaps,
    cameraOptions: props.cameraOptions,
  });
  const onError = useGlobalErrorHandler();
  const [mutate, state] = useUpdateFormElementMapCameraMutation({ onError });
  return (
    <SurveyMapPortal mapContext={mapContext}>
      {basemaps.length > 1 && <MiniBasemapSelector basemaps={basemaps} right />}
      <MapboxMap className="w-full h-full" showNavigationControls={true} />
      {props.admin && (
        <MapCameraCaptureButton
          saving={state.loading}
          onClick={(cameraOptions) => {
            if (props.formElementId) {
              mutate({
                variables: {
                  id: props.formElementId,
                  mapCameraOptions: cameraOptions,
                },
              });
            }
          }}
          map={mapContext.manager?.map}
        />
      )}
    </SurveyMapPortal>
  );
}
