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
import {
  LegendsContext,
  MapManagerContext,
  MapOverlayContext,
  SketchLayerContext,
} from "../dataLayers/MapContextManager";
import { BasemapContext } from "../dataLayers/BasemapContext";
import MapUIProvider from "../dataLayers/MapUIContext";

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
  const {
    basemaps,
    managerState,
    sketchLayerState,
    basemapState,
    legendsState,
    mapOverlayState,
  } = useMapEssentials({
    filterBasemapIds: props.basemaps,
    cameraOptions: props.cameraOptions,
  });
  const { manager } = managerState;
  const onError = useGlobalErrorHandler();
  const [mutate, state] = useUpdateFormElementMapCameraMutation({ onError });
  const windowSize = useWindowSize();

  return (
    <MapManagerContext.Provider value={managerState}>
      <SketchLayerContext.Provider value={sketchLayerState}>
        <BasemapContext.Provider value={{ ...basemapState, basemaps }}>
          <MapOverlayContext.Provider value={mapOverlayState}>
            <LegendsContext.Provider value={legendsState}>
              <MapUIProvider preferencesKey="survey-contextual-map">
                  <SurveyMapPortal>
                    {!props.displayShowMapButton && (
                      <MapPicker basemaps={basemaps}>
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
                            getMapTopLayoutMapHeight(
                              props.isSmall,
                              windowSize.height
                            ) - 18,
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
              </MapUIProvider>
            </LegendsContext.Provider>
          </MapOverlayContext.Provider>
        </BasemapContext.Provider>
      </SketchLayerContext.Provider>
    </MapManagerContext.Provider>
  );
}
