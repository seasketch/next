import { ArrowLeftIcon, ArrowsExpandIcon } from "@heroicons/react/outline";
import { CameraOptions } from "mapbox-gl";
import { Trans } from "react-i18next";
import MapCameraCaptureButton from "../admin/surveys/MapCameraCaptureButton";
import useMapEssentials from "../admin/surveys/useMapEssentials";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import MapboxMap from "../components/MapboxMap";
import MapPicker from "../components/MapPicker";
import {
  ResetCamera,
  ShowScaleBar,
  ShowCoordinates,
} from "../draw/MapSettingsPopup";
import { SurveyMapPortal } from "../formElements/FormElement";
import { useUpdateFormElementMapCameraMutation } from "../generated/graphql";
import useWindowSize from "../useWindowSize";
import { getMapTopLayoutMapHeight } from "./SurveyAppLayout";
import SurveyButton from "./SurveyButton";
import { MapManagerContext } from "../dataLayers/MapContextManager";
import BasemapContextProvider from "../dataLayers/BasemapContext";
import MapManagerContextProvider from "../dataLayers/MapManagerContextProvider";
import MapUIProvider from "../dataLayers/MapUIContext";
import { useContext } from "react";
import getSlug from "../getSlug";

export default function SurveyContextualMap(props: {
  basemaps: number[];
  cameraOptions?: CameraOptions;
  admin?: boolean;
  formElementId?: number;
  hideControls?: boolean;
  displayShowMapButton?: boolean;
  onRequestStageChange?: (stage: number) => void;
  displayHideMapButton?: boolean;
  isSmall: boolean;
}) {
  const { basemaps, bounds, cameraOptions } = useMapEssentials({
    filterBasemapIds: props.basemaps,
    cameraOptions: props.cameraOptions,
  });
  const slug = getSlug();

  return (
    <BasemapContextProvider
      basemaps={basemaps}
      preferencesKey={`${slug}-${props.formElementId}-survey-contextual-map-basemap`}
    >
      <MapManagerContextProvider bounds={bounds} camera={cameraOptions}>
        <MapUIProvider
          preferencesKey={`${slug}-${props.formElementId}-survey-contextual-map-ui`}
        >
          <SurveyContextualMapInner {...props} />
        </MapUIProvider>
      </MapManagerContextProvider>
    </BasemapContextProvider>
  );
}

function SurveyContextualMapInner(props: {
  basemaps: number[];
  cameraOptions?: CameraOptions;
  admin?: boolean;
  formElementId?: number;
  hideControls?: boolean;
  displayShowMapButton?: boolean;
  onRequestStageChange?: (stage: number) => void;
  displayHideMapButton?: boolean;
  isSmall: boolean;
}) {
  const { manager } = useContext(MapManagerContext);
  const onError = useGlobalErrorHandler();
  const [mutate, state] = useUpdateFormElementMapCameraMutation({ onError });
  const windowSize = useWindowSize();

  return (
    <SurveyMapPortal>
      {!props.displayShowMapButton && (
        <MapPicker>
          <ShowScaleBar />
          <ShowCoordinates />
          {manager?.map && props.cameraOptions && (
            <ResetCamera
              mapContextManager={manager}
              camera={props.cameraOptions}
            />
          )}
        </MapPicker>
      )}
      <MapboxMap
        className={`w-full h-full ${
          props.hideControls ? "hide-all-gl-controls" : ""
        }`}
        showNavigationControls={true}
      />
      {props.displayShowMapButton && (
        <button
          onClick={() => {
            if (props.onRequestStageChange) {
              props.onRequestStageChange(1);
              manager?.map?.resize();
              setTimeout(() => {
                manager?.map?.resize();
              }, 32);
            } else {
              throw new Error("onRequestStageChange not set");
            }
          }}
          style={{
            height:
              getMapTopLayoutMapHeight(props.isSmall, windowSize.height) - 18,
          }}
          className="z-50 absolute top-0 text-white flex items-center w-full justify-center font-semibold space-x-2"
        >
          <ArrowsExpandIcon className="w-8 h-8" />
          <span>
            <Trans ns="surveys">Expand Map</Trans>
          </span>
        </button>
      )}
      {props.displayHideMapButton && (
        <div className="absolute z-40 bottom-10 w-full justify-center flex">
          <SurveyButton
            onClick={() => {
              if (props.onRequestStageChange) {
                props.onRequestStageChange(0);
                manager?.map?.resize();
                setTimeout(() => {
                  manager?.map?.resize();
                }, 32);
              } else {
                throw new Error("onRequestStageChange not set");
              }
            }}
            label={
              <div className="flex items-center space-x-4 text-base">
                <ArrowLeftIcon className="w-5 h-5" />
                <span>
                  <Trans ns="surveys">Return to Survey</Trans>
                </span>
              </div>
            }
          />
        </div>
      )}
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
          map={manager?.map}
        />
      )}
    </SurveyMapPortal>
  );
}
