import { LocationMarkerIcon, MapIcon } from "@heroicons/react/solid";
import { Feature } from "geojson";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import MapboxMap from "../components/MapboxMap";
import SketchGeometryTypeSelector, {
  Icons,
} from "../components/SketchGeometryTypeSelector";
import { useMapContext } from "../dataLayers/MapContextManager";
import { SketchGeometryType, useGetBasemapsQuery } from "../generated/graphql";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyMapPortal,
  SurveyMapPortalContext,
  toFeatureCollection,
  UnsavedSketches,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { motion } from "framer-motion";
import { SurveyStyleContext } from "../surveys/appearance";
import DigitizingTools from "./DigitizingTools";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { LngLatBoundsLike, LngLatLike, Map } from "mapbox-gl";
import DrawLineString from "../draw/DrawLinestring";
import DrawPolygon from "../draw/DrawPolygon";
import { useParams } from "react-router";
import bbox from "@turf/bbox";
import * as MapboxDrawWaypoint from "mapbox-gl-draw-waypoint";
import useMapboxGLDraw, { DigitizingState } from "../draw/useMapboxGLDraw";
import DigitizingActionsPopup, {
  NextQuestion,
  PreviousQuestion,
  ResetView,
  ZoomToFeature,
} from "../draw/DigitizingActionsPopup";
require("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css");

export type SingleSpatialInputProps = {
  startingBounds?: LngLatBoundsLike;
};

/**
 * Displays a rich text section
 */
const SingleSpatialInput: FormElementComponent<
  SingleSpatialInputProps,
  UnsavedSketches
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      slug,
    },
  });

  const [map, setMap] = useState<Map | null>(null);
  // eslint-disable-next-line i18next/no-literal-string
  const mapContext = useMapContext(`form-element-${props.id}`);
  const mapPortalContext = useContext(SurveyMapPortalContext);
  const style = useContext(SurveyStyleContext);
  const geometryType = props.sketchClass!.geometryType!;

  const { digitizingState, actions } = useMapboxGLDraw(
    map,
    geometryType,
    props.value?.features[0] || null,
    (feature) => {
      if (feature) {
        props.onChange(toFeatureCollection([feature], true), false);
      } else {
        props.onChange(toFeatureCollection([], true), false);
      }
    }
  );

  useEffect(() => {
    if (mapContext?.manager && data?.projectBySlug?.basemaps) {
      mapContext.manager?.setBasemaps(data.projectBySlug.basemaps);
    }
  }, [data?.projectBySlug?.basemaps, mapContext.manager]);

  return (
    <>
      <div className="mb-5">
        <FormElementBody
          required={props.isRequired}
          formElementId={props.id}
          isInput={true}
          body={props.body}
          editable={props.editable}
        />
      </div>
      {mapPortalContext && (
        <SurveyMapPortal mapContext={mapContext}>
          <motion.div
            className="flex items-center justify-center"
            variants={{
              start: {
                opacity: 0,
              },
              displayed: {
                opacity: 1,
              },
              exit: {
                opacity: 0,
              },
            }}
            initial={"start"}
            animate={"displayed"}
            exit={"exit"}
            transition={{
              duration: 0.1,
              delay: 0.2,
              delayChildren: 1,
            }}
          >
            <DigitizingTools
              onRequestEdit={actions.edit}
              state={digitizingState}
              geometryType={geometryType}
              onRequestFinishEditing={actions.finishEditing}
              onRequestReset={() => {
                if (
                  window.confirm(
                    t("Are you sure you want to delete this shape?", {
                      ns: "surveys",
                    })
                  )
                ) {
                  actions.reset();
                }
              }}
              onRequestSubmit={() => {
                if (props.value?.features?.length) {
                  props.onSubmit();
                }
              }}
            >
              <PreviousQuestion
                phoneOnly={true}
                onClick={props.onRequestPrevious}
              />
              <NextQuestion
                phoneOnly={true}
                onClick={props.onRequestNext}
                disabled={props.isRequired && !props.value?.features.length}
              />
              <ResetView
                map={mapContext.manager?.map!}
                bounds={
                  props.componentSettings.startingBounds || [
                    [-119.91579655058345, 33.87415760617607],
                    [-119.24033098014716, 34.2380902987356],
                  ]
                }
              />
              <ZoomToFeature
                map={mapContext.manager?.map!}
                feature={props.value?.features[0]}
                isSmall={style.isSmall}
                geometryType={props.sketchClass!.geometryType!}
              />
            </DigitizingTools>
            <MapboxMap
              hideDrawControls
              onLoad={(map) => setMap(map)}
              className="w-full h-full absolute top-0 bottom-0"
              initOptions={{
                logoPosition: "bottom-left",
                attributionControl: !style.isSmall,
              }}
            />
          </motion.div>
        </SurveyMapPortal>
      )}
      <FormElementEditorPortal
        render={(
          updateBaseSetting,
          updateSetting,
          updateSurveySettings,
          updateSketchClass
        ) => {
          return (
            <>
              <div>
                <h4 className="block text-sm font-medium leading-5 text-gray-800">
                  {t("Geometry Type")}
                </h4>
                <p className="text-sm text-gray-500 mb-2 mt-1">
                  <Trans ns="admin:surveys">
                    Geometry type cannot be changed after responses are
                    collected
                  </Trans>
                </p>
                <SketchGeometryTypeSelector
                  value={props.sketchClass!.geometryType}
                  onChange={(geometryType) =>
                    updateSketchClass({
                      geometryType,
                    })
                  }
                  simpleFeatures
                />
              </div>
            </>
          );
        }}
      />
    </>
  );
};

SingleSpatialInput.label = <Trans ns="admin:surveys">Single Location</Trans>;
SingleSpatialInput.description = (
  <Trans ns="admin:surveys">One spatial feature without attributes</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
SingleSpatialInput.defaultBody = questionBodyFromMarkdown(`
# Where do you keep your boat?
`);

SingleSpatialInput.icon = ({ componentSettings, sketchClass }) => {
  const Icon = Icons[sketchClass?.geometryType || SketchGeometryType.Point];
  return (
    <div className="bg-red-500 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
      <Icon className="text-white w-5 h-6" />
    </div>
  );
};

export default SingleSpatialInput;

SingleSpatialInput.hideNav = (componentSettings, isMobile, stage) => {
  if (isMobile) {
    return true;
  } else {
    return false;
  }
};
