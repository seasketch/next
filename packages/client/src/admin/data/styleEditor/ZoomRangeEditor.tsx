import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Cross1Icon,
  TrashIcon,
  TriangleDownIcon,
} from "@radix-ui/react-icons";
import { Trans } from "react-i18next";
import * as Editor from "./Editors";
import * as Slider from "@radix-ui/react-slider";
import { useContext, useEffect, useState } from "react";
import { MapContext } from "../../../dataLayers/MapContextManager";
import { LayerPropertyUpdater } from "./GUIStyleEditor";

export function ZoomRangeEditor({
  minzoom,
  maxzoom,
  onChange,
}: {
  minzoom?: number;
  maxzoom?: number;
  onChange: (minzoom?: number, maxzoom?: number) => void;
}) {
  const [zoom, setZoom] = useState(0);
  const mapContext = useContext(MapContext);
  useEffect(() => {
    if (mapContext.manager?.map) {
      const onZoom = () => {
        setZoom(
          Math.round((mapContext.manager?.map?.getZoom() || 0) * 10) / 10
        );
      };
      mapContext.manager.map.on("zoom", onZoom);
      setZoom(Math.round((mapContext.manager?.map?.getZoom() || 0) * 10) / 10);
      return () => {
        mapContext.manager?.map?.off("zoom", onZoom);
      };
    }
  }, [mapContext.manager?.map]);
  if (minzoom === undefined && maxzoom === undefined) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center group text-sm h-10">
      <h3 className="capitalize text-sm flex-1 items-center space-x-2 flex mr-2">
        <span className="">
          <Trans ns="admin:data">zoom range</Trans>
        </span>
        <button
          onClick={() => {
            onChange(undefined, undefined);
          }}
          className="opacity-0 group-hover:opacity-80 text-indigo-300"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </h3>
      <Editor.Control>
        <Slider.Root
          className="relative flex items-center select-none touch-none w-44 h-5"
          value={[minzoom || 1, maxzoom || 24]}
          min={1}
          max={24}
          step={1}
          minStepsBetweenThumbs={1}
          onValueChange={(v) => {
            onChange(v[0], v[1]);
          }}
        >
          <TriangleDownIcon
            style={{
              // move the zoom indicator according to the current zoom level
              // along the track
              transform: `translateX(${((zoom || 5) / 24) * 176}px)`,
            }}
            className="w-7 h-7 absolute -top-3.5 -left-2.5 text-green-400 opacity-50 pointer-events-none transform"
          />
          <Slider.Track className="bg-gray-800 bg-opacity-90 border-b border-gray-600  relative grow rounded h-1 w-full">
            <Slider.Range className="absolute bg-indigo-500 rounded h-full" />
          </Slider.Track>
          <Editor.Thumb aria-label="minzoom" />
          <Editor.Thumb aria-label="maxzoom" />
        </Slider.Root>
      </Editor.Control>
    </div>
  );
}

export function LimitZoomTrigger({
  updateLayerProperty,
  minzoom,
  maxzoom,
}: {
  updateLayerProperty: LayerPropertyUpdater;
  minzoom?: number;
  maxzoom?: number;
}) {
  return (
    <>
      {minzoom !== undefined || maxzoom !== undefined ? (
        <span className="text-sm text-gray-400">
          <Trans ns="admin:data">zoom </Trans>
          {minzoom || 0}-{maxzoom || 24}
        </span>
      ) : (
        <div className="flex flex-1 group pb-2 justify-end">
          {minzoom === undefined && maxzoom === undefined && (
            <button
              title="limit to zoom range"
              onClick={() => {
                updateLayerProperty(undefined, "minzoom", 3);
                updateLayerProperty(undefined, "maxzoom", 14);
              }}
              className="flex items-center space-x-1 text-indigo-200 opacity-20 group-hover:opacity-80"
            >
              <ArrowRightIcon />
              <ArrowLeftIcon />
            </button>
          )}
        </div>
      )}
    </>
  );
}
