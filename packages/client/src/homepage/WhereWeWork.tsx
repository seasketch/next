import mapboxgl, { AnyLayer } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { useWhereWeWorkQuery } from "../generated/graphql";
import slugify from "slugify";

const GOOGLE_MAPS_TILE_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}";

/**
   * Azores
Belize
Brazil
Maldives
Samoa
Florida FWC
Bermuda
FSM
Kiribati
California
   */

type BBox = [number, number, number, number];

export type WhereWeWorkProps = {
  onBBoxCallback?: (bbox: BBox) => void;
};

const caseStudies: Array<{
  r: string;
  o: string;
  bbox: BBox;
  tilejson?: string;
  sourceLayer?: string;
  geojson?: string;
  layers?: any[];
}> = [
  {
    r: "Azores",
    o: "Co‑design planning across 1M+ km² EEZ.",
    bbox: [-31.5, 35.5, -24.5, 40.5],
    geojson:
      "https://d25m7krdtlz75j.cloudfront.net/a9e155e1-a1c7-48b2-a12e-2520ecb5e8d1",
  },
  {
    r: "Belize",
    o: "Co‑design planning across 1M+ km² EEZ.",
    bbox: [-90.0, 15.0, -86.0, 19.0],
    tilejson:
      "https://tiles.seasketch.org/projects/belize/public/a78653cc-b6ef-4c69-8165-ea170ca15059.json",
    sourceLayer: "Coastal Planning Regions",
  },
  {
    r: "Brazil",
    o: "Co‑design planning across 2M+ km² EEZ.",
    bbox: [-74.0, -34.0, -28.0, 6.0],
    tilejson:
      "https://tiles.seasketch.org/projects/brasil/public/7129c0f8-8194-444d-8ecf-6a738e056fd3.json",
    sourceLayer: "amazonia_azul_regioes_v2",
  },
  {
    r: "Maldives",
    o: "Co‑design planning across 1M+ km² EEZ.",
    bbox: [71.0, -1.0, 74.5, 8.5],
    tilejson:
      "https://tiles.seasketch.org/projects/maldives/public/6a888989-56cf-4106-8de5-8f061a832e98.json",
    sourceLayer: "ECO_reef",
  },
  {
    r: "Samoa",
    o: "National MSP with extensive community engagement.",
    bbox: [-173.9, -14.5, -171.0, -13.0],
    geojson:
      "https://d25m7krdtlz75j.cloudfront.net/c6ee86e0-d372-4e4d-b363-69aaa67ba59c",
  },
  {
    r: "Federated States of Micronesia",
    o: "Co‑design planning across 1M+ km² EEZ.",
    bbox: [138.0, 0.0, 164.0, 12.0],
    geojson:
      "https://d25m7krdtlz75j.cloudfront.net/9db2e827-bfa7-44e6-a91c-862da6bc644c",
  },
  {
    r: "Kiribati",
    o: "Co‑design planning across 1M+ km² EEZ.",
    bbox: [170.0, -15.0, 180.0, 7.0],
    geojson:
      "https://uploads.seasketch.org/projects/kiribati/public/d4fea92c-b3c3-4057-ba46-978b34c2e0a4.geojson.json",
  },
  {
    r: "California",
    o: "Co‑design planning across 1M+ km² EEZ.",
    bbox: [-125.0, 32.0, -114.0, 42.5],
    tilejson:
      "https://tiles.seasketch.org/projects/california/public/39d3e365-f1d5-46eb-9c31-5c4a0f6b6f76.json",
    sourceLayer: "0747d6d8-364e-4d85-83e9-5348e9261baf",
  },
];

/* eslint-disable i18next/no-literal-string */
export default function WhereWeWork({ onBBoxCallback }: WhereWeWorkProps) {
  const { data } = useWhereWeWorkQuery();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  useEffect(() => {
    // @ts-ignore
    if ((map && !map._removed) || !mapRef.current) return;
    const session = data?.gmapssatellitesession?.session;
    if (!session) return;

    const newMap = new mapboxgl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              `${GOOGLE_MAPS_TILE_URL}?session=${session}&key=${process.env.REACT_APP_GOOGLE_MAPS_2D_TILE_API_KEY}`,
            ],
            format: "jpeg",
            attribution: "Google",
            tileSize: 512,
          },
          projects: {
            type: "geojson",
            data: "https://api.seasket.ch/projects.geojson.json",
          },
          ...caseStudies
            .filter((c) => c.tilejson && c.sourceLayer)
            .reduce((sources, c) => {
              sources[slugify(c.r)] = {
                type: "vector",
                url: c.tilejson,
              };
              return sources;
            }, {} as any),
          ...caseStudies
            .filter((c) => c.geojson)
            .reduce((sources, c) => {
              sources[slugify(c.r)] = {
                type: "geojson",
                data: c.geojson,
              };
              return sources;
            }, {} as any),
        },
        layers: [
          {
            id: "satellite-layer",
            type: "raster",
            source: "satellite",
            minzoom: 0,
            maxzoom: 22,
          },
          {
            id: "projects-layer",
            type: "circle",
            source: "projects",
            minzoom: 1,
            maxzoom: 22,
            paint: {
              "circle-radius": 3,
              "circle-color": "white",
              "circle-blur": 0.5,
            },
          },
          ...caseStudies
            .filter((c) => (c.tilejson && c.sourceLayer) || c.geojson)
            .map((c) => {
              const sourceName = slugify(c.r);
              if (c.layers) {
                return c.layers.map(
                  (l, i) =>
                    ({
                      ...l,
                      id: `${sourceName}-layer-${i}`,
                      source: sourceName,
                      ...(c.tilejson && c.sourceLayer
                        ? { "source-layer": c.sourceLayer }
                        : {}),
                    } as AnyLayer)
                );
              }
              const common =
                c.tilejson && c.sourceLayer
                  ? { "source-layer": c.sourceLayer }
                  : {};
              return [
                {
                  id: `${sourceName}-layer`,
                  source: sourceName,
                  type: "fill",
                  paint: {
                    "fill-color": "orange",
                    "fill-opacity": 0.25,
                  },
                  ...(common as any),
                } as AnyLayer,
                {
                  id: `${sourceName}-layer-outline`,
                  source: sourceName,
                  type: "line",
                  paint: {
                    "line-color": "orange",
                    "line-opacity": 1,
                    "line-width": 1,
                  },
                  ...(common as any),
                },
              ];
            })
            .flat(),
        ],
      },
      center: [-51.96945310350668, 17.698806276167744],
      zoom: 2.3,
      // center: [0, 0],
      // zoom: 1,
      // @ts-ignore
      projection: "globe",
      cooperativeGestures: true,
      attributionControl: false,
    });

    newMap.addControl(new mapboxgl.AttributionControl(), "bottom-left");

    // @ts-ignore
    window.newMap = newMap;
    setMap(newMap);

    newMap.on("load", () => {
      newMap.setFog({
        range: [1, 5],
        color: "rgba(255, 255, 255, 0.4)",
        "horizon-blend": 0.1,
        "high-color": "rgba(55, 120, 255, 0.5)",
        "space-color": "rgba(0, 0, 0, 1)",
        "star-intensity": 0.5,
      });
    });

    return () => {
      newMap.remove();
      setMap(null);
    };
  }, [data?.gmapssatellitesession?.session, mapRef]);

  return (
    <section
      id="projects"
      className=" bg-slate-800 text-slate-50 from-slate-950 to-slate-800 bg-gradient-to-t relative h-128"
    >
      <div ref={mapRef} className="w-full h-full absolute top-0 left-0 z-0" />
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-slate-900 to-transparent z-0"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-black/50 to-transparent z-0"></div>

      <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent z-0 pointer-events-none">
        <ul className="space-y-4 w-96 absolute xl:right-8 right-0 top-0 h-full overflow-y-auto p-2 py-4 pointer-events-auto">
          {caseStudies.map((c) => (
            <li
              key={c.r}
              className="flex items-center gap-4 rounded-xl px-3 py-3  border border-white/10 backdrop-blur-sm pointer-events-auto cursor-pointer bg-gradient-to-r from-slate-700/20 to-slate-700/50 hover:bg-gradient-to-br hover:to-slate-600/50 active:bg-gradient-to-t active:from-yellow-500/20 active:to-yellow-300/30"
              onClick={() => {
                if (onBBoxCallback) {
                  onBBoxCallback(c.bbox);
                } else if (map) {
                  map.fitBounds(
                    [
                      [c.bbox[0], c.bbox[1]],
                      [c.bbox[2], c.bbox[3]],
                    ] as mapboxgl.LngLatBoundsLike,
                    {
                      padding: 80,
                      duration: 800,
                    }
                  );
                }
              }}
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold truncate">{c.r}</h3>
                <p className="mt-1 text-sm text-slate-100 truncate">{c.o}</p>
                <div className="mt-2 flex gap-4 text-sm">
                  <a
                    className="text-sky-500 hover:underline"
                    href="/projects/case-study"
                  >
                    Case study →
                  </a>
                  <a
                    className="text-slate-300 hover:underline"
                    href="/projects/app"
                  >
                    Open project →
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mx-auto pointer-events-none p-8 ">
        <div className="relative flex items-end justify-between gap-6 z-10 xl:pl-8">
          <div>
            <h2
              style={{
                textShadow: "black 1px 0 15px",
              }}
              className="text-4xl font-semibold tracking-tight text-shadow-lg"
            >
              Where we work
            </h2>
            <p className="mt-2 text-slate-100 max-w-2xl">
              SeaSketch is currently used in over 20 countries around the world.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
