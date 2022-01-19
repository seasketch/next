import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  ZoomInIcon,
} from "@heroicons/react/outline";
import bbox from "@turf/bbox";
import { AnimatePresence, motion } from "framer-motion";
import { BBox, Feature, FeatureCollection } from "geojson";
import { map } from "lodash";
import mapboxgl, { LngLatBoundsLike, LngLatLike, Map } from "mapbox-gl";
import React, {
  Component,
  ComponentClass,
  FunctionComponent,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { Icons } from "../components/SketchGeometryTypeSelector";
import Switch from "../components/Switch";
import MapContextManager, {
  MapContext,
  MapContextInterface,
} from "../dataLayers/MapContextManager";
import {
  BasemapDetailsFragment,
  SketchGeometryType,
} from "../generated/graphql";
import { SurveyStyleContext } from "../surveys/appearance";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import { useLocalForage } from "../useLocalForage";

const DigitizingActionsPopup: FunctionComponent<{
  open: boolean;
  anchor?: HTMLElement;
  onRequestClose: () => void;
}> = ({ anchor, onRequestClose, open, children }) => {
  const { t } = useTranslation("surveys");
  const { x, y } = anchor?.getBoundingClientRect() || { x: 0, y: 0 };
  const { isSmall } = useContext(SurveyLayoutContext).style;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          transition={{ duration: 0.1 }}
          variants={{ open: { opacity: 1 }, closed: { opacity: 0 } }}
          initial="closed"
          animate="open"
          exit="closed"
          onClick={onRequestClose}
          className={`absolute top-0 left-0 z-50 w-screen h-screen bg-opacity-60 sm:bg-opacity-10 bg-black select-none`}
        >
          <motion.div
            // onClick={(e) => e.stopPropagation()}
            transition={{ duration: 0.15 }}
            initial="closed"
            animate="open"
            exit="closed"
            variants={{ open: { scale: 1 }, closed: { scale: 0 } }}
            className="fixed sm:absolute w-full shadow-lg mx-auto bg-white dark:bg-gray-600 p-2 text-gray-700 dark:text-gray-100 flex-col bottom-15 sm:rounded flex sm:w-60 pt-3 sm:pt-2"
            style={
              isSmall
                ? {}
                : {
                    left: x - 120,
                    bottom:
                      document.body.getBoundingClientRect().height - y + 14,
                  }
            }
          >
            <div className="flex flex-col">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default DigitizingActionsPopup;

const Item: FunctionComponent<{
  onClick: (e: React.MouseEvent<any, MouseEvent>) => void;
  title: string;
  Icon?: FunctionComponent<{ className?: string }>;
  disabled?: boolean;
  phoneOnly?: boolean;
  selected?: boolean;
}> = ({ onClick, title, Icon, disabled, phoneOnly, selected }) => {
  const { isSmall } = useContext(SurveyLayoutContext).style;
  if (phoneOnly && !isSmall) {
    return null;
  }
  return (
    <button
      className={`flex text-left w-full items-center px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-opacity-50 rounded ${
        disabled ? "opacity-50" : ""
      } ${selected ? "font-semibold " : ""}`}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          onClick(e);
        }
      }}
    >
      <h4 className="flex-1">{title}</h4>
      <div>{Icon && <Icon className="w-5 h-5" />}</div>
    </button>
  );
};

const ZoomOutIcon: FunctionComponent<{ className?: string }> = (props) => {
  return (
    <svg
      viewBox="0 0 24 24"
      height="48"
      width="48"
      focusable="false"
      role="img"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={`${props.className}`}
    >
      <rect width="24" height="24" fill="none"></rect>
      <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"></path>
    </svg>
  );
};

export type DigitizingActionItem<T = {}> = {
  disabled?: boolean;
  phoneOnly?: boolean;
} & T;

export function PreviousQuestion(
  props: DigitizingActionItem<{ onClick: () => void }>
) {
  const { t } = useTranslation("surveys");
  return (
    <Item {...props} Icon={ChevronUpIcon} title={t("Previous Question")} />
  );
}

export function NextQuestion(
  props: DigitizingActionItem<{ onClick: () => void }>
) {
  const { t } = useTranslation("surveys");
  return (
    <Item
      {...props}
      Icon={ChevronDownIcon}
      title={t("Skip to next question")}
    />
  );
}

export function ResetView(
  props: DigitizingActionItem<{ map: Map; bounds: BBox }>
) {
  const { t } = useTranslation("surveys");
  return (
    <Item
      {...props}
      Icon={ZoomOutIcon}
      onClick={() =>
        props.map.fitBounds(props.bounds as LngLatBoundsLike, { animate: true })
      }
      title={t("Reset view")}
    />
  );
}

export function ZoomToFeature(
  props: DigitizingActionItem<{
    map: Map;
    feature?: Feature<any> | FeatureCollection<any>;
    isSmall: boolean;
    geometryType: SketchGeometryType;
    title?: string;
  }>
) {
  const { t } = useTranslation("surveys");
  const Icon = Icons[props.geometryType];
  return (
    <Item
      {...props}
      Icon={Icon}
      disabled={props.disabled || !props.feature}
      onClick={() =>
        props.map.fitBounds(bbox(props.feature) as LngLatBoundsLike, {
          animate: true,
          padding: props.isSmall ? 50 : 100,
          maxZoom: 17,
        })
      }
      title={props.title || t("Focus on location")}
    />
  );
}

export function ShowScaleBar(
  props: DigitizingActionItem<{
    mapContext?: MapContextInterface;
  }>
) {
  const { t } = useTranslation("surveys");
  const show = !!props.mapContext?.manager?.scaleVisible;

  return (
    <Item
      {...props}
      Icon={(childProps) => (
        <Switch
          {...childProps}
          className="scale-75"
          isToggled={show}
          onClick={(value, e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            if (props.mapContext?.manager) {
              props.mapContext.manager.toggleScale(value);
            }
          }}
        />
      )}
      onClick={
        (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          if (props.mapContext?.manager) {
            props.mapContext.manager.toggleScale(
              !props.mapContext.manager.scaleVisible
            );
          }
        }
        // props.map.fitBounds(bbox(props.feature) as LngLatBoundsLike, {
        //   animate: true,
        //   padding: props.isSmall ? 50 : 100,
        //   maxZoom: 17,
        // })
      }
      title={t("Show scale bar", { ns: "surveys" })}
    />
  );
}

export function BasemapControl({
  basemaps,
  afterChange,
}: {
  basemaps: BasemapDetailsFragment[];
  afterChange?: () => void;
}) {
  const mapContext = useContext(MapContext);
  const selectedBasemap = mapContext.manager?.getSelectedBasemap();
  const { t } = useTranslation("surveys");

  return (
    <div>
      {basemaps.length > 1 && (
        <>
          <hr className="my-3 w-full mx-auto dark:border-gray-500" />
          <h4
            className={`w-full items-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400`}
          >
            {t("Basemap")}
          </h4>
          <div>
            {basemaps.map((basemap) => {
              const selected = basemap.id === selectedBasemap?.id;
              return (
                <Item
                  selected={selected}
                  key={basemap.id.toString()}
                  Icon={() => (
                    <img
                      alt={`${basemap.name} basemap`}
                      className={`w-8 h-8 rounded ${
                        selected ? "shadow ring-2 ring-blue-600" : ""
                      }`}
                      src={basemap.thumbnail}
                    />
                  )}
                  title={basemap.name}
                  onClick={() => {
                    if (mapContext.manager) {
                      mapContext.manager.setSelectedBasemap(
                        basemap.id.toString()
                      );
                      if (afterChange) {
                        afterChange();
                      }
                    }
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
