import { useTranslation } from "react-i18next";
import AddRemoteServiceMapModal from "./AddRemoteServiceMapModal";
import { useEffect, useState } from "react";
import { EventData, Map, MapDataEvent, MapMouseEvent } from "mapbox-gl";
import { interpolateWarm as scale } from "d3-scale-chromatic";

export default function AddGFWSourceModal({
  onRequestClose,
}: {
  onRequestClose: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const [map, setMap] = useState<Map | null>(null);
  const [state, setState] = useState({
    year: new Date().getFullYear() - 1,
    zoom: 0,
    hoverData: null as null | {
      cell: number;
      properties: any;
      layerId: string;
    },
    legend: {} as { [z: number]: { value: number; color: string }[] },
  });

  useEffect(() => {
    if (map) {
      const dateRange = [
        new Date(state.year, 0, 1),
        new Date(state.year, 11, 31),
      ]
        .map((d) => d.toISOString().split("T")[0])
        .join(",");
      console.log("dateRange", dateRange);
      const controller = new AbortController();
      const layers = map
        .getStyle()
        .layers.filter((l) => "source" in l && l.source === "gfw");
      if (layers.length) {
        for (const layer of layers) {
          map.removeLayer(layer.id);
        }
      }
      if (map.getSource("gfw")) {
        map.removeSource("gfw");
      }
      getBins(dateRange, controller.signal)
        .then((bins) => {
          map.addSource("gfw", {
            type: "vector",
            maxzoom: 12,
            promoteId: "cell",
            tiles: [
              `https://gateway.api.globalfishingwatch.org/v3/4wings/tile/heatmap/{z}/{x}/{y}?datasets[0]=public-global-fishing-effort:latest&date-range=2023-01-01,2024-01-01&token=${process.env.REACT_APP_GFW_API_TOKEN}&interval=YEAR&format=MVT&temporal-aggregation=true`,
            ],
          });
          const sourceLayer = "main";
          const levels = Object.keys(bins);

          for (const z of levels) {
            const steps: (number | string)[] = [];
            const legend: { value: number; color: string }[] = [];
            for (var i = 0; i < bins[z].length; i++) {
              const entry = bins[z][i];
              if (entry.value !== 0) {
                steps.push(entry.value);
              }
              const finalColor = scale(i / bins[z].length);
              steps.push(finalColor);
              legend.push({
                value: entry.value,
                color: finalColor,
              });
            }
            // for (const entry of bins[z]) {
            //   if (entry.value !== 0) {
            //     steps.push(entry.value);
            //   }
            //   const colorValues = /(\d+),(\d+),(\d+),(\d+)/
            //     .exec(entry.color)!
            //     .slice(1) as [string, string, string, string];
            //   const finalColor = `rgba(${colorValues.slice(0, 3).join(",")},${
            //     parseInt(colorValues[3]) / 255.0
            //   })`;
            //   steps.push(finalColor);
            //   legend.push({
            //     value: entry.value,
            //     color: finalColor,
            //   });
            // }
            setState((prev) => ({
              ...prev,
              legend: {
                ...prev.legend,
                [parseInt(z)]: legend,
              },
            }));
            map.addLayer({
              id: `gfw-${z}`,
              minzoom: parseInt(z),
              ...(levels[levels.length - 1] !== z
                ? { maxzoom: parseInt(z) + 1 }
                : {}),
              type: "fill",
              source: "gfw",
              "source-layer": sourceLayer,
              paint: {
                "fill-color": [
                  "step",
                  ["to-number", ["get", "count"], 0],
                  ...(steps.length <= 2 ? ["transparent", 1, steps[0]] : steps),
                ],
                "fill-outline-color": "transparent",
                "fill-opacity": [
                  "interpolate",
                  ["linear"],
                  ["to-number", ["get", "count"], -1],
                  -1,
                  0,
                  0,
                  0.08,
                  1,
                  1,
                ],
              },
            });
          }
          map.addLayer({
            id: "gfw-hovered-feature",
            type: "line",
            source: "gfw",
            "source-layer": sourceLayer,
            paint: {
              "line-color": "rgb(255,255,255)",
              "line-width": 4,
              "line-offset": 2,
              "line-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                1,
                0,
              ],
            },
            layout: {
              "line-sort-key": ["get", "cell"],
            },
          });

          // map.addLayer({
          //   id: "gfw",
          //   type: "fill",
          //   source: "gfw",
          //   "source-layer": "main",
          //   paint: {
          //     "fill-color": "rgba(255, 0, 0, 0.5)",
          //   },
          // });
        })
        .catch((e) => {
          if (e.message !== "Aborted") {
            console.error(e);
          }
        });
      let hoveredId: string | number | null | undefined = null;
      const mouseMoveHandler = (e: MapMouseEvent & EventData) => {
        const layers = map
          .getStyle()
          .layers.filter((l) => /gfw-/.test(l.id) && !/hover/.test(l.id))
          .map((l) => l.id);
        const features = map.queryRenderedFeatures(e.point, {
          layers,
        });
        if (hoveredId) {
          map.removeFeatureState({
            source: "gfw",
            sourceLayer: "main",
            id: hoveredId,
          });
          hoveredId = null;
        }
        const f = features[0];
        if (f) {
          console.log(f.properties);
          map.setFeatureState(
            {
              source: "gfw",
              sourceLayer: "main",
              id: f.id,
            },
            { hover: true }
          );
          setState((prev) => ({
            ...prev,
            hoverData: {
              cell: f.id as number,
              properties: f.properties,
              layerId: f.layer.id,
            },
          }));
          hoveredId = f.id;
        } else {
          setState((prev) => ({
            ...prev,
            hoverData: null,
          }));
        }
      };
      const zoomHandler = () => {
        setState((prev) => ({
          ...prev,
          zoom: map.getZoom(),
        }));
      };
      map.on("zoom", zoomHandler);
      map.on("mousemove", mouseMoveHandler);
      return () => {
        controller.abort();
        if (map) {
          map.off("mousemove", mouseMoveHandler);
        }
      };
    }
  }, [map, state.year, setState]);

  const currentLegend = state.legend[Math.min(12, Math.floor(state.zoom))];

  return (
    <AddRemoteServiceMapModal
      onRequestClose={onRequestClose}
      title={t("Add Global Fishing Watch Data")}
      onMapLoad={setMap}
    >
      {Math.round(state.zoom) && (
        <div className="z-50 rounded absolute left-96 ml-5 top-2 bg-black bg-opacity-50 text-indigo-200">
          {Math.round(state.zoom * 100) / 100}
        </div>
      )}
      {state.hoverData && (
        <div className="z-50 rounded absolute right-2 top-2 bg-black bg-opacity-50 text-indigo-100">
          {state.hoverData.properties &&
          state.hoverData.properties[state.year] === 1
            ? t("1 hour fished")
            : !state.hoverData.properties[state.year]
            ? t("< 1 hour fished")
            : state.hoverData.properties[state.year] + " " + t("hours fished")}
        </div>
      )}
      <div>
        <form>
          <label htmlFor="year">{t("Year")}</label>
          <select
            value={state.year.toString()}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                year: parseInt(e.target.value),
              }))
            }
          >
            {/* <option value="all">{t("All data since 2012")}</option> */}
            {[...new Array(new Date().getFullYear() - 2012).keys()]
              .reverse()
              .map((n) => n + 2012)
              .map((year) => (
                <option value={year}>{year}</option>
              ))}
          </select>
        </form>
      </div>
      {currentLegend && (
        <div>
          <h3>{t("Legend")}</h3>
          <div className="flex flex-col text-right">
            {currentLegend.map((step) => (
              <div
                className="flex-1 px-2 py-1 font-bold"
                style={{
                  background: step.color,
                  height: "20px",
                }}
              >
                {step.value}
              </div>
            ))}
          </div>
        </div>
      )}
    </AddRemoteServiceMapModal>
  );
}

async function getBins(dateRange: string, signal: AbortSignal, maxZoom = 12) {
  const zoomLevels = Array.from({ length: maxZoom + 1 }, (_, i) => i);
  const bins: { [z: string]: { color: string; value: number }[] } = {};
  for (const z of zoomLevels) {
    if (signal.aborted) {
      throw new Error("Aborted");
    }
    const url = new URL(
      `https://gateway.api.globalfishingwatch.org/v2/4wings/bins/${z}`
    );
    url.searchParams.set("date-range", dateRange);
    url.searchParams.set("datasets[0]", "public-global-fishing-effort:latest");
    url.searchParams.set("token", process.env.REACT_APP_GFW_API_TOKEN!);
    url.searchParams.set("interval", "year");
    url.searchParams.set("num-bins", "10");
    url.searchParams.set("temporal-aggregation", "true");
    const response = await fetch(url.toString(), { signal });
    const data = await response.json();
    if (!data.entries) {
      throw new Error("No data found for date range " + dateRange);
    } else {
      bins[z] = data.entries[0].map((entry: number) => ({
        value: Math.round(entry) / 400,
        color: scale(data.entries.indexOf(entry) / data.entries.length),
      }));
    }
  }
  return bins;
}

let responseCache: any = null;

async function getBinsByStyleEndpoint(
  dateRange: string,
  signal: AbortSignal
  // maxZoom = 12
) {
  // const zoomLevels = Array.from({ length: maxZoom + 1 }, (_, i) => i);
  const bins: { [z: string]: { color: string; value: number }[] } = {};
  // for (const z of zoomLevels) {
  if (signal.aborted) {
    throw new Error("Aborted");
  }
  const url = new URL(
    `https://gateway.api.globalfishingwatch.org/v3/4wings/generate-png`
  );
  url.searchParams.set("date-range", dateRange);
  url.searchParams.set("datasets[0]", "public-global-fishing-effort:latest");
  url.searchParams.set("token", process.env.REACT_APP_GFW_API_TOKEN!);
  url.searchParams.set("interval", "YEAR");
  url.searchParams.set("color", "#55ffd2");
  // url.searchParams.set("num-bins", "20");
  // url.searchParams.set("temporal-aggregation", "true");
  if (!responseCache) {
    const response = await fetch(url.toString(), { signal, method: "POST" });
    const data = await response.json();
    responseCache = data;
  }
  const data = responseCache;
  if (!data.colorRamp.stepsByZoom) {
    throw new Error("No data found for date range " + dateRange);
  } else {
    for (const key in data.colorRamp.stepsByZoom) {
      const z = parseInt(key);
      const entries = data.colorRamp.stepsByZoom[key] as {
        color: string;
        value: number;
      }[];
      bins[z] = entries.sort((a, b) => a.value - b.value);
    }
    // bins[z] = data.entries[0];
    // if (z === 8) {
    //   bins[8] = [0, 1, 2, 5, 10, 20, 40, 80, 100, 200];
    // } else if (z === 9) {
    //   bins[9] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    // }
  }
  // }
  return bins;
}
