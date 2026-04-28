import mapboxgl, { LngLatBoundsLike, Map as MapboxMap } from "mapbox-gl";
import cloneDeep from "lodash.clonedeep";
import { RefreshIcon } from "@heroicons/react/outline";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  BasemapDetailsFragment,
  DataLayer,
  FullAdminSourceFragment,
} from "../../generated/graphql";
import {
  loadBaseStyleForBasemap,
  replaceOverlayOnMap,
  tocOrSourceBounds,
} from "./cartographyComparisonMap";

const TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
if (TOKEN) {
  mapboxgl.accessToken = TOKEN;
}

type DataLayerPreview = Pick<
  DataLayer,
  "id" | "sourceLayer" | "sublayer" | "dataSourceId"
>;

function clampSplitPct(
  pct: number,
  widthPx: number,
  pad: { left: number; right: number }
): number {
  if (widthPx <= 0 || pad.left + pad.right >= widthPx) {
    return pct;
  }
  const minPct = (pad.left / widthPx) * 100;
  const maxPct = ((widthPx - pad.right) / widthPx) * 100;
  return Math.min(maxPct, Math.max(minPct, pct));
}

function fitMapsToBounds(
  primary: MapboxMap,
  secondary: MapboxMap | null,
  tocBounds: (number | null)[] | null | undefined,
  dataSourceBounds: FullAdminSourceFragment["bounds"]
) {
  const pair = tocOrSourceBounds(tocBounds ?? null, dataSourceBounds ?? null);
  const bounds: LngLatBoundsLike | null = pair
    ? [
        [pair[0], pair[1]],
        [pair[2], pair[3]],
      ]
    : null;
  if (!bounds) {
    return;
  }
  try {
    primary.fitBounds(bounds, { animate: false, padding: 48 });
    if (secondary) {
      secondary.jumpTo({
        center: primary.getCenter(),
        zoom: primary.getZoom(),
        bearing: primary.getBearing(),
        pitch: primary.getPitch(),
      });
    }
  } catch {
    // ignore invalid bounds
  }
}

function initialBoundsOptions(
  tocBounds: (number | null)[] | null | undefined,
  dataSourceBounds: FullAdminSourceFragment["bounds"]
) {
  const pair = tocOrSourceBounds(tocBounds ?? null, dataSourceBounds ?? null);
  if (!pair) {
    return {};
  }
  const bounds: LngLatBoundsLike = [
    [pair[0], pair[1]],
    [pair[2], pair[3]],
  ];
  return {
    bounds,
    fitBoundsOptions: { padding: 48 },
  };
}

export default function CartographyRevisionSplitMap({
  variant = "compare",
  basemap,
  dataSource,
  dataLayer,
  leftStyles,
  rightStyles,
  tocBounds,
  leftLabel,
  rightLabel,
  leftActionLabel,
  leftActionLoading,
  leftActionDisabled,
  onLeftAction,
  edgePaddingPx = { left: 50, right: 50 },
}: {
  variant?: "compare" | "single";
  basemap?: BasemapDetailsFragment | null;
  dataSource: FullAdminSourceFragment;
  dataLayer: DataLayerPreview;
  leftStyles: unknown[];
  rightStyles?: unknown[];
  tocBounds?: (number | null)[] | null;
  leftLabel?: string;
  rightLabel?: string;
  leftActionLabel?: string;
  leftActionLoading?: boolean;
  leftActionDisabled?: boolean;
  onLeftAction?: () => void;
  edgePaddingPx?: { left: number; right: number };
}) {
  const { t } = useTranslation("admin:data");
  const wrapRef = useRef<HTMLDivElement>(null);
  const leftEl = useRef<HTMLDivElement>(null);
  const rightEl = useRef<HTMLDivElement>(null);
  const singleEl = useRef<HTMLDivElement>(null);

  const leftMapRef = useRef<MapboxMap | null>(null);
  const rightMapRef = useRef<MapboxMap | null>(null);
  const singleMapRef = useRef<MapboxMap | null>(null);

  const tocBoundsRef = useRef(tocBounds);
  tocBoundsRef.current = tocBounds;
  const sourceBoundsRef = useRef(dataSource.bounds);
  sourceBoundsRef.current = dataSource.bounds;

  const leftStylesRef = useRef(leftStyles);
  leftStylesRef.current = leftStyles;
  const rightStylesRef = useRef(rightStyles);
  rightStylesRef.current = rightStyles;
  const dataSourceRef = useRef(dataSource);
  dataSourceRef.current = dataSource;
  const dataLayerRef = useRef(dataLayer);
  dataLayerRef.current = dataLayer;

  const syncing = useRef(false);

  const [splitPct, setSplitPct] = useState(50);
  /** Bumps when map instances are (re)created so overlay effects re-attach */
  const [mapsEpoch, setMapsEpoch] = useState(0);
  const [baseStyle, setBaseStyle] = useState<import("mapbox-gl").Style | null>(
    null
  );
  const [styleError, setStyleError] = useState<string | null>(null);
  const dragRef = useRef(false);
  const splitInitialized = useRef(false);

  const leftStylesKey = useMemo(() => JSON.stringify(leftStyles), [leftStyles]);
  const rightStylesKey = useMemo(
    () => JSON.stringify(rightStyles ?? []),
    [rightStyles]
  );

  useEffect(() => {
    let cancelled = false;
    setStyleError(null);
    loadBaseStyleForBasemap(basemap ?? undefined)
      .then((s) => {
        if (!cancelled) {
          setBaseStyle(s);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setStyleError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [basemap]);

  // eslint-disable-next-line i18next/no-literal-string -- Mapbox source id prefix
  const overlayLeftKey = `ss-carto-${dataLayer.id}-left`;
  // eslint-disable-next-line i18next/no-literal-string -- Mapbox source id prefix
  const overlayRightKey = `ss-carto-${dataLayer.id}-right`;
  // eslint-disable-next-line i18next/no-literal-string -- Mapbox source id prefix
  const overlaySingleKey = `ss-carto-${dataLayer.id}-single`;

  useLayoutEffect(() => {
    if (variant !== "compare" || !wrapRef.current) {
      return;
    }
    const w = wrapRef.current.clientWidth;
    const mid = clampSplitPct(50, w, edgePaddingPx);
    if (!splitInitialized.current) {
      setSplitPct(mid);
      splitInitialized.current = true;
    } else {
      setSplitPct((prev) => clampSplitPct(prev, w, edgePaddingPx));
    }
  }, [variant, edgePaddingPx]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || variant !== "compare") {
      return;
    }
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setSplitPct((prev) => clampSplitPct(prev, w, edgePaddingPx));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, edgePaddingPx]);

  /** Create maps once per basemap / layer source; overlays applied in separate effects */
  useEffect(() => {
    if (!baseStyle || !TOKEN || styleError) {
      return undefined;
    }

    if (variant === "single") {
      if (!singleEl.current) {
        return undefined;
      }
      const initialView = initialBoundsOptions(
        tocBoundsRef.current,
        sourceBoundsRef.current ?? null
      );
      const map = new mapboxgl.Map({
        container: singleEl.current,
        style: cloneDeep(baseStyle),
        attributionControl: true,
        ...initialView,
      });
      singleMapRef.current = map;
      map.once("load", () => {
        fitMapsToBounds(
          map,
          null,
          tocBoundsRef.current,
          sourceBoundsRef.current ?? null
        );
        replaceOverlayOnMap(
          map,
          overlaySingleKey,
          dataSourceRef.current,
          dataLayerRef.current,
          leftStylesRef.current
        );
        setMapsEpoch((n) => n + 1);
      });
      return () => {
        map.remove();
        singleMapRef.current = null;
      };
    }

    if (!leftEl.current || !rightEl.current) {
      return undefined;
    }

    const initialView = initialBoundsOptions(
      tocBoundsRef.current,
      sourceBoundsRef.current ?? null
    );
    const lm = new mapboxgl.Map({
      container: leftEl.current,
      style: cloneDeep(baseStyle),
      attributionControl: true,
      ...initialView,
    });
    const rm = new mapboxgl.Map({
      container: rightEl.current,
      style: cloneDeep(baseStyle),
      attributionControl: false,
      ...initialView,
    });
    leftMapRef.current = lm;
    rightMapRef.current = rm;

    let loads = 0;
    const applyCompareOverlays = () => {
      replaceOverlayOnMap(
        lm,
        overlayLeftKey,
        dataSourceRef.current,
        dataLayerRef.current,
        leftStylesRef.current
      );
      replaceOverlayOnMap(
        rm,
        overlayRightKey,
        dataSourceRef.current,
        dataLayerRef.current,
        rightStylesRef.current ?? []
      );
    };

    const onReady = () => {
      loads += 1;
      if (loads < 2) {
        return;
      }
      fitMapsToBounds(
        lm,
        rm,
        tocBoundsRef.current,
        sourceBoundsRef.current ?? null
      );
      const pull = (from: MapboxMap, to: MapboxMap) => {
        if (syncing.current) {
          return;
        }
        syncing.current = true;
        to.jumpTo({
          center: from.getCenter(),
          zoom: from.getZoom(),
          bearing: from.getBearing(),
          pitch: from.getPitch(),
        });
        syncing.current = false;
      };
      lm.on("move", () => pull(lm, rm));
      rm.on("move", () => pull(rm, lm));
      /** After both styles are loaded, paint cartography on top (avoids right map missing layers due to effect ordering). */
      requestAnimationFrame(() => {
        applyCompareOverlays();
        setMapsEpoch((n) => n + 1);
      });
    };

    lm.once("load", onReady);
    rm.once("load", onReady);

    return () => {
      lm.remove();
      rm.remove();
      leftMapRef.current = null;
      rightMapRef.current = null;
    };
    // Intentionally omit tocBounds / bounds arrays from deps so parent re-renders
    // with new array identities do not tear down maps; refs hold latest bounds for fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStyle, styleError, variant, dataLayer.id, dataSource.id]);

  /** Compare — left map overlay only */
  useEffect(() => {
    const map = leftMapRef.current;
    if (!map || variant !== "compare") {
      return undefined;
    }
    const run = () => {
      if (leftMapRef.current !== map || !map.loaded()) {
        return;
      }
      replaceOverlayOnMap(
        map,
        overlayLeftKey,
        dataSource,
        dataLayer,
        leftStyles
      );
    };
    if (map.loaded()) {
      run();
    } else {
      map.once("load", run);
    }
    return undefined;
    // leftStylesKey covers leftStyles; full object in run() is always from latest render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapsEpoch,
    leftStylesKey,
    variant,
    overlayLeftKey,
    dataSource,
    dataLayer,
  ]);

  /** Compare — right map overlay only */
  useEffect(() => {
    const map = rightMapRef.current;
    if (!map || variant !== "compare") {
      return undefined;
    }
    const rs = rightStyles ?? [];
    const run = () => {
      if (rightMapRef.current !== map || !map.loaded()) {
        return;
      }
      replaceOverlayOnMap(map, overlayRightKey, dataSource, dataLayer, rs);
    };
    if (map.loaded()) {
      run();
    } else {
      map.once("load", run);
    }
    return undefined;
    // rightStylesKey covers rightStyles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapsEpoch,
    rightStylesKey,
    variant,
    overlayRightKey,
    dataSource,
    dataLayer,
  ]);

  /** Single map overlay */
  useEffect(() => {
    const map = singleMapRef.current;
    if (!map || variant !== "single") {
      return undefined;
    }
    const run = () => {
      if (singleMapRef.current !== map || !map.loaded()) {
        return;
      }
      replaceOverlayOnMap(
        map,
        overlaySingleKey,
        dataSource,
        dataLayer,
        leftStyles
      );
    };
    if (map.loaded()) {
      run();
    } else {
      map.once("load", run);
    }
    return undefined;
    // leftStylesKey covers leftStyles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapsEpoch,
    leftStylesKey,
    variant,
    overlaySingleKey,
    dataSource,
    dataLayer,
  ]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current || !wrapRef.current || variant !== "compare") {
        return;
      }
      const rect = wrapRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const rawPct = (x / rect.width) * 100;
      setSplitPct(clampSplitPct(rawPct, rect.width, edgePaddingPx));
    };
    const onUp = () => {
      dragRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [variant, edgePaddingPx]);

  if (styleError) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {styleError}
      </div>
    );
  }

  if (!TOKEN) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {t("Map preview requires a Mapbox access token to be configured.")}
      </div>
    );
  }

  if (variant === "single") {
    return (
      <div
        ref={wrapRef}
        className="relative h-full min-h-0 w-full overflow-hidden bg-gray-100"
      >
        {!baseStyle && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/80 text-sm text-gray-600">
            {t("Loading map")}
          </div>
        )}
        <div ref={singleEl} className="absolute inset-0 z-0" aria-hidden />
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 w-full overflow-hidden bg-gray-100"
    >
      {!baseStyle && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-white/80 text-sm text-gray-600">
          {t("Loading map")}
        </div>
      )}
      {leftLabel && (
        <div className="absolute left-3 top-3 z-[6] flex items-center gap-1.5">
          <div className="pointer-events-none rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-700 shadow-sm ring-1 ring-black/5">
            {leftLabel}
          </div>
          {onLeftAction && leftActionLabel && (
            <button
              type="button"
              disabled={leftActionDisabled || leftActionLoading}
              onClick={onLeftAction}
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-white hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:pointer-events-none disabled:opacity-60"
            >
              <RefreshIcon className="h-3 w-3" aria-hidden />
              {leftActionLoading ? t("Rolling back") : leftActionLabel}
            </button>
          )}
        </div>
      )}
      {rightLabel && (
        <div className="pointer-events-none absolute right-3 top-3 z-[6] rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-700 shadow-sm ring-1 ring-black/5">
          {rightLabel}
        </div>
      )}
      <div
        ref={leftEl}
        className="absolute inset-0 z-0"
        style={{
          clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
        }}
        aria-hidden
      />
      <div
        ref={rightEl}
        className="absolute inset-0 z-0"
        style={{
          clipPath: `inset(0 0 0 ${splitPct}%)`,
        }}
        aria-hidden
      />
      <button
        type="button"
        className="group absolute top-0 bottom-0 z-10 flex w-12 -translate-x-1/2 cursor-ew-resize items-center justify-center border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        style={{ left: `${splitPct}%` }}
        onPointerDown={(e) => {
          e.preventDefault();
          dragRef.current = true;
        }}
        aria-label={t("Adjust comparison divider")}
      >
        <span
          className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-white/90 shadow group-hover:bg-primary-200"
          aria-hidden
        />
        <span
          className="relative inline-flex flex-row items-center gap-0.5 rounded-full border border-gray-200 bg-white/95 px-1.5 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur group-hover:border-primary-200"
          aria-hidden
        >
          <span className="h-8 w-0.5 rounded-full bg-gray-400 group-hover:bg-primary-500/80" />
          <span className="h-8 w-0.5 rounded-full bg-gray-400 group-hover:bg-primary-500/80" />
          <span className="h-8 w-0.5 rounded-full bg-gray-400 group-hover:bg-primary-500/80" />
        </span>
      </button>
    </div>
  );
}
