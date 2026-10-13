import { ReactNode, useContext, useMemo, useRef } from "react";
import { Feature, FeatureCollection, LineString, Polygon } from "geojson";
import { ArrowLeftIcon, Cross2Icon, GlobeIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { useReportStyleToggle } from "../hooks/useReportStyleToggle";
import { ReportCardTitleToolbarContext } from "./ReportCardTitleToolbar";
import {
  boundsForCollection,
  DistancePathBasemap,
  DistancePathMap,
  FIT_PADDING,
  usePathCollection,
} from "./DistancePathMap";
import {
  DEFAULT_SHORELINE_OVERLAP_COLOR,
  distancePathReportStyle,
} from "./distancePathStyle";

function fitPair(
  bounds: ReturnType<typeof boundsForCollection>
): [[number, number], [number, number]] | null {
  if (!bounds || bounds.isEmpty()) return null;
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [
    [sw.lng, sw.lat],
    [ne.lng, ne.lat],
  ];
}

function MainMapToggle({
  promoted,
  onClick,
}: {
  promoted: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("reports");
  const label = promoted
    ? t("Remove from main map")
    : t("Show on main map");
  return (
    <button
      type="button"
      aria-pressed={promoted}
      onClick={onClick}
      className={`group flex h-7 max-w-full items-center rounded-full border pl-1.5 pr-1.5 text-[13px] font-medium text-gray-800 shadow-sm backdrop-blur-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        promoted
          ? "border-blue-300/70 bg-blue-50/80"
          : "border-black/10 bg-white/80 hover:bg-white/90"
      }`}
    >
      <span className="flex shrink-0 items-center" aria-hidden>
        {promoted ? (
          <Cross2Icon className="h-3.5 w-3.5" />
        ) : (
          <>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <GlobeIcon className="h-3.5 w-3.5" />
          </>
        )}
      </span>
      <span
        className={`grid transition-[grid-template-columns,opacity] duration-200 ease-out ${
          promoted
            ? "grid-cols-[1fr] opacity-100"
            : "grid-cols-[0fr] opacity-0 group-hover:grid-cols-[1fr] group-hover:opacity-100 group-focus-visible:grid-cols-[1fr] group-focus-visible:opacity-100"
        }`}
      >
        <span className="overflow-hidden">
          <span className="block whitespace-nowrap pl-1.5 pr-2.5">{label}</span>
        </span>
      </span>
    </button>
  );
}

/**
 * Distance map that can hand its layers to the project map. Stays mounted when
 * `collapsed` so a table tab does not drop those layers.
 */
export function PromotedDistanceMap({
  collapsed = false,
  paths,
  labels,
  distances,
  emptyMessage,
  caption,
  sketchGeojsonUrl,
  basemap = "streets",
  shorelineColor = DEFAULT_SHORELINE_OVERLAP_COLOR,
  fitPaddingTop = FIT_PADDING,
  fitPaddingBottom,
  heightClass = "h-56",
  endpoints = true,
  sketchId,
  overlay = null,
  searchFrame = null,
  searchArea = null,
}: {
  collapsed?: boolean;
  paths: Feature<LineString>[];
  labels?: Array<string | null>;
  distances?: Array<string | null>;
  emptyMessage: string;
  caption?: string;
  sketchGeojsonUrl?: string | null;
  basemap?: DistancePathBasemap;
  shorelineColor?: string;
  fitPaddingTop?: number;
  fitPaddingBottom?: number;
  heightClass?: string;
  /** Draw origin and destination dots. Off for a shoreline intersection. An array sets this per path. */
  endpoints?: boolean | boolean[];
  sketchId: number;
  /**
   * Sits on the bottom control row, between the promote control and the map
   * attribution. It shifts right while the promote label is open.
   */
  overlay?: ReactNode;
  /** Passed through when there are no routes, so the map can frame the sketch. */
  searchFrame?: [[number, number], [number, number]] | null;
  /** Simplified sketch buffered by the search limit. Drawn under the sketch. */
  searchArea?: FeatureCollection<Polygon> | null;
}) {
  const { adminMode, printing } = useContext(ReportUIStateContext);
  const { manager } = useContext(MapManagerContext);
  const card = useContext(ReportCardTitleToolbarContext);
  const instanceId = useRef(
    // eslint-disable-next-line i18next/no-literal-string
    `distance-path-${Math.random().toString(36).slice(2)}`
  );
  const collection = usePathCollection(paths, labels, distances, endpoints);
  const bounds = useMemo(() => boundsForCollection(collection), [collection]);
  const fitBounds = useMemo(() => fitPair(bounds), [bounds]);
  const style = useMemo(
    () =>
      adminMode || !bounds
        ? null
        : distancePathReportStyle({
            collection,
            sketchGeojsonUrl,
            basemap,
            shorelineColor,
          }),
    [adminMode, bounds, collection, sketchGeojsonUrl, basemap, shorelineColor]
  );
  const { visible, setVisible, canPromote } = useReportStyleToggle(
    card.cardId,
    sketchId,
    instanceId.current,
    style,
    { fitBounds: adminMode ? null : fitBounds }
  );
  const showToggle =
    canPromote && !adminMode && !printing && Boolean(manager) && Boolean(bounds);
  const promoted = visible && !printing;
  const toggle = showToggle ? (
    <MainMapToggle
      promoted={promoted}
      onClick={() => setVisible(!promoted)}
    />
  ) : null;

  // Table view keeps this mounted so the project-map layers stay up, without
  // the remove control. That control lives on the map.
  if (collapsed) return null;

  return (
    <DistancePathMap
      paths={paths}
      labels={labels}
      distances={distances}
      emptyMessage={emptyMessage}
      caption={caption}
      sketchGeojsonUrl={sketchGeojsonUrl}
      basemap={basemap}
      shorelineColor={shorelineColor}
      fitPaddingTop={fitPaddingTop}
      fitPaddingBottom={fitPaddingBottom}
      heightClass={heightClass}
      endpoints={endpoints}
      interactive={!promoted}
      searchFrame={searchFrame}
      searchArea={searchArea}
      overlay={
        toggle || overlay ? (
          <div className="pointer-events-none absolute bottom-2 left-2 right-12 z-10 flex items-center">
            {toggle ? (
              <div className="pointer-events-auto shrink-0 print:hidden">
                {toggle}
              </div>
            ) : null}
            {overlay ? (
              <>
                <div className="min-w-1.5 flex-1" />
                {overlay}
                <div className="min-w-1.5 flex-1" />
              </>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
