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
import DigitizingInstructions, {
  DigitizingState,
} from "./DigitizingInstructions";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Map } from "mapbox-gl";
import DrawLineString from "../draw/DrawLinestring";
import DrawPolygon from "../draw/DrawPolygon";
import { useParams } from "react-router";

export type SingleSpatialInputProps = {};

/**
 * Displays a rich text section
 */
const SingleSpatialInput: FormElementComponent<
  SingleSpatialInputProps,
  UnsavedSketches
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const [digitizingState, setDigitizingState] = useState(
    props.value?.features?.length
      ? DigitizingState.FINISHED
      : DigitizingState.BLANK
  );
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useGetBasemapsQuery({
    variables: {
      slug,
    },
  });

  const [map, setMap] = useState<Map | null>(null);
  const [draw, setDraw] = useState<MapboxDraw | null>(null);
  // eslint-disable-next-line i18next/no-literal-string
  const mapContext = useMapContext(`form-element-${props.id}`);
  const mapPortalContext = useContext(SurveyMapPortalContext);
  const style = useContext(SurveyStyleContext);
  const geometryType = props.sketchClass!.geometryType!;
  const drawMode = glDrawMode(style.isSmall, geometryType);
  useEffect(() => {
    if (map) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: drawMode,
        modes: Object.assign(
          {
            draw_line_string: DrawLineString,
            draw_polygon: DrawPolygon,
          },
          MapboxDraw.modes
        ),
      });
      setDraw(draw);
      map.addControl(draw);
      if (props.value && props.value.features?.length) {
        draw.add(props.value.features[0]);
        draw.changeMode("direct_select", {
          featureId: props.value.features[0].id,
        });
      }
      map.on("draw.create", function (e) {
        setDigitizingState(DigitizingState.FINISHED);
        props.onChange(toFeatureCollection(e.features, true), false);
      });

      map.on("draw.update", function (e) {
        props.onChange(toFeatureCollection(e.features, true), false);
      });

      map.on("seasketch.drawing_started", function (e) {
        setDigitizingState(DigitizingState.STARTED);
      });
      map.on("seasketch.can_complete", function (e) {
        setDigitizingState(DigitizingState.CAN_COMPLETE);
      });
      map.on("draw.delete", function (e) {
        setDigitizingState(DigitizingState.BLANK);
        draw.changeMode(drawMode);
      });
      map.on("draw.selectionchange", function (e) {
        if (e.features.length) {
          setDigitizingState(DigitizingState.EDITING);
        } else {
          setDigitizingState(DigitizingState.FINISHED);
        }
      });

      return () => {
        map.removeControl(draw);
      };
    }
  }, [map]);

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
            <DigitizingInstructions
              state={digitizingState}
              geometryType={geometryType}
              onRequestTrash={() => {
                if (draw) {
                  draw.trash();
                }
              }}
              onRequestSubmit={() => {
                if (props.value?.features?.length) {
                  props.onSubmit();
                }
              }}
            />
            <MapboxMap
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

export function glDrawMode(
  isSmall: boolean,
  geometryType: SketchGeometryType
): string {
  // if (isSmall) {
  // } else {
  if (geometryType === SketchGeometryType.Point) {
    return "draw_point";
  } else if (geometryType === SketchGeometryType.Linestring) {
    return "draw_line_string";
  } else if (geometryType === SketchGeometryType.Polygon) {
    return "draw_polygon";
  }
  // }
  throw new Error("Not implemented");
}
