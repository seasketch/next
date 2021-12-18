import { BBox, FeatureCollection } from "geojson";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import MapboxMap from "../components/MapboxMap";
import SketchGeometryTypeSelector, {
  Icons,
} from "../components/SketchGeometryTypeSelector";
import { useMapContext } from "../dataLayers/MapContextManager";
import {
  BasemapDetailsFragment,
  FormElementLayout,
  SketchGeometryType,
  useGetBasemapsQuery,
} from "../generated/graphql";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  SurveyMapPortal,
  SurveyMapPortalContext,
  toFeatureCollection,
  UnsavedSketches,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import { motion } from "framer-motion";
import { SurveyStyleContext } from "../surveys/appearance";
import DigitizingTools from "./DigitizingTools";
import { LngLatBoundsLike, Map, Style } from "mapbox-gl";
import { useParams } from "react-router";
import useMapboxGLDraw from "../draw/useMapboxGLDraw";
import {
  BasemapControl,
  NextQuestion,
  PreviousQuestion,
  ResetView,
  ZoomToFeature,
} from "../draw/DigitizingActionsPopup";
import BoundsInput from "../admin/surveys/BoundsInput";
import BasemapMultiSelectInput from "../admin/surveys/BasemapMultiSelectInput";
import DigitizingMiniMap from "./DigitizingMiniMap";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
require("@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css");

const defaultStartingBounds = [
  -119.91579655058345,
  33.87415760617607,
  -119.24033098014716,
  34.2380902987356,
] as BBox;

export type SingleSpatialInputProps = {
  startingBounds?: BBox;
  basemaps?: number[];
};

const SingleSpatialInput: FormElementComponent<
  SingleSpatialInputProps,
  { collection: FeatureCollection<any> }
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const { slug } = useParams<{ slug: string }>();
  const onError = useGlobalErrorHandler();
  const { data } = useGetBasemapsQuery({
    variables: {
      slug,
    },
    onError,
  });

  const [map, setMap] = useState<Map | null>(null);
  const [miniMap, setMiniMap] = useState<Map | null>(null);
  const [miniMapStyle, setMiniMapStyle] = useState<Style>();
  const mapContext = useMapContext();
  const layoutContext = useContext(SurveyLayoutContext);
  const mapPortalContext = layoutContext.mapPortal;
  const style = layoutContext.style;
  const context = useContext(SurveyContext);
  const bounds =
    props.componentSettings.startingBounds ||
    context?.projectBounds ||
    defaultStartingBounds;

  const geometryType = props.sketchClass!.geometryType!;

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
    props.value?.collection?.features[0] || null,
    (feature) => {
      if (feature) {
        props.onChange(
          { collection: toFeatureCollection([feature], true) },
          false
        );
      } else {
        props.onChange({ collection: toFeatureCollection([], true) }, false);
      }
    }
  );

  const [basemaps, setBasemaps] = useState<BasemapDetailsFragment[]>([]);

  useEffect(() => {
    if (mapContext?.manager && data?.projectBySlug?.basemaps?.length) {
      let basemaps: BasemapDetailsFragment[] = [];
      if (props.componentSettings.basemaps?.length) {
        basemaps = data.projectBySlug.basemaps.filter(
          (b) => props.componentSettings.basemaps?.indexOf(b.id) !== -1
        );
      }
      if (!basemaps.length) {
        basemaps = [data.projectBySlug.basemaps[0]];
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
  }, [
    data?.projectBySlug?.basemaps,
    mapContext.manager,
    props.componentSettings.basemaps,
  ]);

  async function updateMiniBasemap() {
    if (miniMap && mapContext.manager && data?.projectBySlug?.basemaps) {
      const style = await mapContext.manager.getComputedStyle();
      setMiniMapStyle(style.style);
    }
  }

  useEffect(() => {
    if (mapContext.manager && data?.projectBySlug?.basemaps) {
      mapContext.manager
        .getComputedStyle()
        .then((style) => setMiniMapStyle(style.style));
    }
  }, [mapContext.manager, data?.projectBySlug?.basemaps]);

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
              delay: 0.2,
              delayChildren: 1,
            }}
          >
            <DigitizingTools
              onRequestEdit={actions.edit}
              state={digitizingState}
              geometryType={geometryType}
              onRequestFinishEditing={actions.finishEditing}
              topologyErrors={kinks.features.length > 0}
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
                if (props.value?.collection.features?.length) {
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
                disabled={
                  props.isRequired && !props.value?.collection.features.length
                }
              />
              <ResetView map={mapContext.manager?.map!} bounds={bounds} />
              <ZoomToFeature
                map={mapContext.manager?.map!}
                feature={props.value?.collection.features[0]}
                isSmall={style.isSmall}
                geometryType={props.sketchClass!.geometryType!}
              />
              <BasemapControl
                basemaps={basemaps}
                afterChange={updateMiniBasemap}
              />
            </DigitizingTools>
            <MapboxMap
              hideDrawControls
              onLoad={(map) => {
                setMap(map);
              }}
              className="w-full h-full absolute top-0 bottom-0"
              initOptions={{
                logoPosition: "bottom-left",
                attributionControl: !style.isSmall,
              }}
            />
            {miniMapStyle && map && (
              <DigitizingMiniMap
                topologyErrors={kinks.features.length > 0}
                style={miniMapStyle}
                dragTarget={dragTarget}
                onLoad={(map) => setMiniMap(map)}
              />
            )}
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
              <BoundsInput
                value={bounds}
                map={map || undefined}
                onBeforeInput={() => disable()}
                onAfterInput={() => enable()}
                onChange={updateSetting(
                  "startingBounds",
                  props.componentSettings
                )}
              />
              <BasemapMultiSelectInput
                value={props.componentSettings.basemaps}
                onChange={updateSetting(
                  "basemaps",
                  props.componentSettings.basemaps
                )}
              />
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
