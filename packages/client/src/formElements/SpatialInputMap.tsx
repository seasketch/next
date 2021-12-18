import { useState } from "react";
import { BBox, FeatureCollection } from "geojson";
import { LngLatBoundsLike, Map } from "mapbox-gl";
import { useContext, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import MapboxMap from "../components/MapboxMap";
import { useMapContext } from "../dataLayers/MapContextManager";
import useMapboxGLDraw from "../draw/useMapboxGLDraw";
import {
  BasemapDetailsFragment,
  SketchGeometryType,
  useGetBasemapsAndRegionQuery,
  useGetBasemapsQuery,
} from "../generated/graphql";
import { SurveyStyleContext } from "../surveys/appearance";
import {
  FormElementEditorPortal,
  SurveyMapPortal,
  toFeatureCollection,
} from "./FormElement";
import bbox from "@turf/bbox";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import DigitizingTools from "./DigitizingTools";
import { useTranslation } from "react-i18next";
import {
  BasemapControl,
  NextQuestion,
  PreviousQuestion,
  ResetView,
  ZoomToFeature,
} from "../draw/DigitizingActionsPopup";
import { motion } from "framer-motion";
import BoundsInput from "../admin/surveys/BoundsInput";

export const defaultStartingBounds = [
  -119.91579655058345,
  33.87415760617607,
  -119.24033098014716,
  34.2380902987356,
] as BBox;

interface SpatialInputMapProps {
  basemapIds?: number[];
  startingBounds?: BBox;
  editable?: boolean;
  value?: FeatureCollection<any>;
  onChange?: (collection: FeatureCollection<any>) => void;
  setProps?: (id: string, properties: { [key: string]: any }) => void;
  geometryType: SketchGeometryType;
  componentSettings: any;
  onLoad?: (
    map: Map,
    enable: () => void,
    disable: () => void,
    initialBounds: BBox
  ) => void;
}

export default function SpatialInputMap(props: SpatialInputMapProps) {
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const { data } = useGetBasemapsAndRegionQuery({ onError });
  const { t } = useTranslation("surveys");
  const mapContext = useMapContext();
  const [map, setMap] = useState<Map | null>(null);
  const style = useContext(SurveyLayoutContext).style;
  const geometryType = props.geometryType!;
  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);
  const bounds =
    props.startingBounds ||
    (data?.currentProject?.region.geojson
      ? bbox(data.currentProject.region.geojson)
      : defaultStartingBounds) ||
    defaultStartingBounds;

  const {
    digitizingState,
    actions,
    disable,
    enable,
    dragTarget,
    kinks,
  } = useMapboxGLDraw(
    map,
    geometryType,
    props.value?.features[0] || null,
    (feature) => {
      if (props.onChange) {
        if (feature) {
          props.onChange(toFeatureCollection([feature], true));
        } else {
          props.onChange(toFeatureCollection([], true));
        }
      }
    }
  );

  useEffect(() => {
    if (mapContext?.manager && data?.currentProject?.basemaps?.length) {
      let basemaps: BasemapDetailsFragment[] = [];
      if (props.basemapIds?.length) {
        basemaps = data.currentProject.basemaps.filter(
          (b) => props.basemapIds!.indexOf(b.id) !== -1
        );
      }
      if (!basemaps.length) {
        basemaps = [data.currentProject.basemaps[0]];
      }
      setBasemaps(basemaps);
      // mapContext.manager.setProjectBounds(bboxPolygon(bounds));
      mapContext.manager?.setBasemaps(basemaps);
      // TODO: This is a pretty shitty way to do this. MapContextManager needs
      // to be modified a bit to account for these simpler use-cases that aren't
      // so bound to project-wide settings
      setTimeout(() => {
        if (mapContext?.manager?.map) {
          mapContext!.manager!.map!.fitBounds(bounds as LngLatBoundsLike, {
            animate: false,
            padding: 2,
          });
        }
      }, 200);
    }
  }, [data?.currentProject?.basemaps, mapContext.manager, props.basemapIds]);

  return (
    <SurveyMapPortal mapContext={mapContext}>
      {/* <motion.div
        className="flex items-center justify-center w-full h-full"
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
          delay: 0.3,
          delayChildren: 1,
        }}
      > */}
      <div className="flex items-center justify-center w-full h-full">
        <DigitizingTools
          state={digitizingState}
          geometryType={geometryType}
          topologyErrors={kinks.features.length > 0}
          onRequestEdit={actions.edit}
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
            // if (props.value?.collection.features?.length) {
            console.log("onSubmit");
            // props.onSubmit();
            // }
          }}
        >
          {/* <PreviousQuestion
                phoneOnly={true}
                onClick={props.onRequestPrevious}
              />
              <NextQuestion
                phoneOnly={true}
                onClick={props.onRequestNext}
                disabled={
                  props.isRequired && !props.value?.collection.features.length
                }
              /> */}
          <ResetView map={mapContext.manager?.map!} bounds={bounds} />
          <ZoomToFeature
            map={mapContext.manager?.map!}
            feature={props.value?.features[0]}
            isSmall={style.isSmall}
            geometryType={geometryType}
          />
          <BasemapControl
            basemaps={basemaps}
            afterChange={() => {
              // updateMiniBasemap
            }}
          />
        </DigitizingTools>
        <MapboxMap
          hideDrawControls
          onLoad={(map) => {
            console.log("SET MAP");
            setMap(map);
          }}
          className="w-full h-full absolute top-0 bottom-0"
          initOptions={{
            logoPosition: "bottom-left",
            attributionControl: !style.isSmall,
          }}
        />
        {/* </motion.div> */}
      </div>
    </SurveyMapPortal>
  );
}
