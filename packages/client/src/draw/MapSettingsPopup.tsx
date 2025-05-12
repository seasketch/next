import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/outline";
import bbox from "@turf/bbox";
import { AnimatePresence, motion } from "framer-motion";
import { BBox, Feature, FeatureCollection } from "geojson";
import { CameraOptions, LngLatBoundsLike, Map } from "mapbox-gl";
import React, {
  FunctionComponent,
  useState,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { Icons } from "../components/SketchGeometryTypeSelector";
import Switch from "../components/Switch";
import MapContextManager, {
  DigitizingLockState,
  MapContext,
  MapContextInterface,
} from "../dataLayers/MapContextManager";
import OptionalBasemapLayerControl from "../dataLayers/OptionalBasemapLayerControl";
import {
  BasemapDetailsFragment,
  SketchGeometryType,
} from "../generated/graphql";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import { MeasureControlContext, MeasureControlLockId } from "../MeasureControl";
import useDialog from "../components/useDialog";

type PopupPosition = "top" | "bottom";

const MapSettingsPopup: FunctionComponent<{
  open: boolean;
  anchor?: HTMLElement;
  onRequestClose: () => void;
  position?: PopupPosition;
}> = ({ anchor, onRequestClose, open, children, position }) => {
  const scrollable = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({
    atBottom: true,
    nearTop: true,
  });

  const handleScroll = useCallback(
    (e) => {
      if (scrollable.current && global.ResizeObserver) {
        const scrollableScrollTop = scrollable.current.scrollTop;
        const contentHeight = scrollable.current.clientHeight;
        const atBottom =
          contentHeight + scrollableScrollTop >
          scrollable.current.scrollHeight - 20;
        const nearTop = scrollableScrollTop < 20;
        setScrollState({ atBottom, nearTop });
      }
    },
    [scrollable]
  );

  useEffect(() => {
    handleScroll({});
  }, [open, handleScroll]);

  useEffect(() => {
    if (scrollable.current && global.ResizeObserver) {
      const observer = new ResizeObserver((entries) => {
        handleScroll({});
      });
      observer.observe(scrollable.current);
      return () => {
        observer.disconnect();
      };
    }
  }, [handleScroll, scrollable]);

  const { isSmall } = useContext(FormElementLayoutContext).style;

  const [left, top, right, bottom] = useMemo(() => {
    const anchorClientRect = anchor?.getBoundingClientRect() || {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };

    const anchorCenter = {
      x: anchorClientRect.x + anchorClientRect.width / 2,
      y: anchorClientRect.y + anchorClientRect.height / 2,
    };
    const bodyClientRect = document.body.getBoundingClientRect();
    const popupWidth = 320;
    // prefer middle, but check for intersection with right and left sides
    // middle of anchor
    let left: number | undefined = anchorCenter.x - popupWidth / 2;
    let right: number | undefined = undefined;
    if (left + popupWidth > bodyClientRect.width) {
      // align the right side of the popup with the right side of the anchor
      right =
        bodyClientRect.width - (anchorClientRect.x + anchorClientRect.width);
      left = undefined;
    }
    // prefer top, but check for intersection with top of browser window
    let top: number | undefined = undefined;
    let bottom: number | undefined =
      bodyClientRect.height -
      (anchorClientRect.y - anchorClientRect.height + 20);
    if (bottom > bodyClientRect.height * 0.5) {
      top = anchorClientRect.y + anchorClientRect.height + 10;
      bottom = undefined;
    }
    return [left, top, right, bottom];
  }, [anchor, anchor?.getBoundingClientRect().top]);

  position = position || "top";

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
            autoFocus
            role="dialog"
            transition={{ duration: 0.15 }}
            initial="closed"
            animate="open"
            exit="closed"
            variants={{ open: { scale: 1 }, closed: { scale: 0 } }}
            className="fixed sm:absolute w-full overflow-hidden shadow-xl mx-auto bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-100 flex-col sm:rounded flex sm:w-80 max-h-144"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              ...(isSmall
                ? { maxHeight: "80vh" }
                : { left, bottom, top, right }),
            }}
          >
            {/* <div className="flex flex-col relative -pb-24"> */}
            <div
              className="overflow-y-auto h-full p-2 pt-3 sm:pt-2"
              ref={scrollable}
              onClick={onRequestClose}
              onScroll={handleScroll}
            >
              {children}
            </div>

            <div
              className={`absolute bottom-0 left-0 w-full h-14 z-50 pointer-events-none duration-75 transition-opacity ${
                scrollState.atBottom ? "opacity-0" : "opacity-100"
              }`}
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, white 100%)",
              }}
            ></div>
            <div
              className={`absolute top-0 left-0 w-full h-14 z-50 pointer-events-none duration-75 transition-opacity ${
                scrollState.nearTop ? "opacity-0" : "opacity-100"
              }`}
              style={{
                background:
                  "linear-gradient(to top, transparent 0%, white 100%)",
              }}
            ></div>

            {/* </div> */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MapSettingsPopup;

const Item: FunctionComponent<{
  /** Return true to close the modal after clicking an item */
  onClick: (e: React.MouseEvent<any, MouseEvent>) => any;
  title: string;
  Icon?: FunctionComponent<{ className?: string }>;
  disabled?: boolean;
  phoneOnly?: boolean;
  selected?: boolean;
  onDisabledClick?: (e: React.MouseEvent<any, MouseEvent>) => any;
}> = ({
  onClick,
  title,
  Icon,
  disabled,
  phoneOnly,
  selected,
  onDisabledClick,
}) => {
  const { isSmall } = useContext(FormElementLayoutContext).style;
  if (phoneOnly && !isSmall) {
    return null;
  }
  return (
    <button
      className={`flex text-left w-full items-center px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-opacity-50 rounded outline-0 focus-visible:ring-2 ${
        disabled ? "opacity-50" : ""
      } ${selected ? "font-semibold " : ""}`}
      onClick={(e) => {
        if (disabled) {
          if (onDisabledClick) {
            onDisabledClick(e);
          }
          e.preventDefault();
          e.stopPropagation();
        } else {
          const close = onClick(e);
          if (close === true) {
          } else {
            e.preventDefault();
            e.stopPropagation();
          }
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

export type MapSettingsActionItem<T = {}> = {
  disabled?: boolean;
  phoneOnly?: boolean;
} & T;

export function PreviousQuestion(
  props: MapSettingsActionItem<{ onClick: () => void }>
) {
  const { t } = useTranslation("surveys");
  return (
    <Item {...props} Icon={ChevronUpIcon} title={t("Previous Question")} />
  );
}

export function NextQuestion(
  props: MapSettingsActionItem<{ onClick: () => void }>
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
  props: MapSettingsActionItem<{ map: Map; bounds: BBox }>
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

export function ResetToProjectBounds(
  props: MapSettingsActionItem<{ mapContextManager?: MapContextManager }>
) {
  const { t } = useTranslation("surveys");
  return (
    <Item
      {...props}
      Icon={ZoomOutIcon}
      onClick={() => {
        props.mapContextManager?.resetToProjectBounds();
        return true;
      }}
      title={t("Reset view")}
    />
  );
}

export function ResetCamera(
  props: MapSettingsActionItem<{
    mapContextManager: MapContextManager;
    camera: CameraOptions;
  }>
) {
  const { t } = useTranslation("surveys");
  return (
    <Item
      {...props}
      Icon={ZoomOutIcon}
      onClick={() => {
        props.mapContextManager.setCamera(props.camera);
      }}
      title={t("Reset view")}
    />
  );
}

export function Measure(props: MapSettingsActionItem<{}>) {
  const { t } = useTranslation("surveys");
  const mapContext = useContext(MapContext);
  const measureContext = useContext(MeasureControlContext);
  const { alert } = useDialog();
  return (
    <Item
      {...props}
      disabled={
        !measureContext ||
        (mapContext?.digitizingLockState !== DigitizingLockState.Free &&
          mapContext?.digitizingLockedBy !== MeasureControlLockId)
      }
      Icon={({ className }: { className?: string }) => (
        <svg
          viewBox="0 0 640 512"
          height="48"
          width="48"
          focusable="false"
          role="img"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          <path
            fill="currentColor"
            d="M635.7 167.2 556.1 31.7c-8.8-15-28.3-20.1-43.5-11.5l-69 39.1L503.3 161c2.2 3.8.9 8.5-2.9 10.7l-13.8 7.8c-3.8 2.2-8.7.9-10.9-2.9L416 75l-55.2 31.3 27.9 47.4c2.2 3.8.9 8.5-2.9 10.7l-13.8 7.8c-3.8 2.2-8.7.9-10.9-2.9L333.2 122 278 153.3 337.8 255c2.2 3.7.9 8.5-2.9 10.7l-13.8 7.8c-3.8 2.2-8.7.9-10.9-2.9l-59.7-101.7-55.2 31.3 27.9 47.4c2.2 3.8.9 8.5-2.9 10.7l-13.8 7.8c-3.8 2.2-8.7.9-10.9-2.9l-27.9-47.5-55.2 31.3 59.7 101.7c2.2 3.7.9 8.5-2.9 10.7l-13.8 7.8c-3.8 2.2-8.7.9-10.9-2.9L84.9 262.9l-69 39.1C.7 310.7-4.6 329.8 4.2 344.8l79.6 135.6c8.8 15 28.3 20.1 43.5 11.5L624.1 210c15.2-8.6 20.4-27.8 11.6-42.8z"
          ></path>
        </svg>
      )}
      onDisabledClick={() => {
        alert(
          t(
            "Finish drawing your shape first. Afterwards you will be able to use the measure tool."
          )
        );
      }}
      onClick={() => {
        if (measureContext.state === "disabled") {
          measureContext.reset();
        } else {
          measureContext.close();
        }
        return true;
      }}
      title={t("Measure")}
    />
  );
}

export function ZoomToFeature(
  props: MapSettingsActionItem<{
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
  props: MapSettingsActionItem<{
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
          tabIndex={-1}
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

export function ShowCoordinates(
  props: MapSettingsActionItem<{
    mapContext?: MapContextInterface;
  }>
) {
  const { t } = useTranslation("surveys");
  const show = !!props.mapContext?.manager?.coordinatesVisible;

  return (
    <Item
      {...props}
      Icon={(childProps) => (
        <Switch
          tabIndex={-1}
          {...childProps}
          className="scale-75"
          isToggled={show}
          onClick={(value, e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            if (props.mapContext?.manager) {
              props.mapContext.manager.toggleCoordinates(value);
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
            props.mapContext.manager.toggleCoordinates(
              !props.mapContext.manager.coordinatesVisible
            );
          }
        }
        // props.map.fitBounds(bbox(props.feature) as LngLatBoundsLike, {
        //   animate: true,
        //   padding: props.isSmall ? 50 : 100,
        //   maxZoom: 17,
        // })
      }
      title={t("Show coordinates", { ns: "homepage" })}
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
      {/* {basemaps.length > 1 && ( */}
      <>
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
                onClick={(e) => {
                  if (mapContext.manager) {
                    mapContext.manager.setSelectedBasemap(
                      basemap.id.toString()
                    );
                    if (afterChange) {
                      afterChange();
                    }
                  }
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            );
          })}
          {selectedBasemap?.optionalBasemapLayers &&
            selectedBasemap.optionalBasemapLayers.length > 0 && (
              <>
                <hr className="my-3 w-full mx-auto dark:border-gray-500" />

                <h4
                  className={`w-full items-center px-3 py-2 text-sm text-gray-500 dark:text-gray-400`}
                >
                  <Trans ns="surveys">Optional Layers</Trans>
                </h4>

                <div
                  className="flex-1 overflow-y-auto px-3 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedBasemap.optionalBasemapLayers.map((lyr) => (
                    <OptionalBasemapLayerControl key={lyr.id} layer={lyr} />
                  ))}
                </div>
              </>
            )}
        </div>
      </>
      {/* )} */}
    </div>
  );
}
