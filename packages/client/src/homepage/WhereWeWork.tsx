import mapboxgl, { AnyLayer } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { useWhereWeWorkQuery } from "../generated/graphql";
import slugify from "slugify";
import { caseStudies, BBox } from "./caseStudies";

const GOOGLE_MAPS_TILE_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}";

type LocalBBox = BBox;

export type WhereWeWorkProps = {
  onBBoxCallback?: (bbox: LocalBBox) => void;
};

// caseStudies imported

/* eslint-disable i18next/no-literal-string */
export default function WhereWeWork({ onBBoxCallback }: WhereWeWorkProps) {
  const { data } = useWhereWeWorkQuery();
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [flashSlug, setFlashSlug] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLUListElement>(null);
  const listItemRefs = useRef<Record<string, HTMLLIElement | null>>({});

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            // attribution: "Google",
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
      center: [163.01221693062644, -10.874227901699726],
      zoom: 2.3,
      // @ts-ignore
      projection: "globe",
      cooperativeGestures: true,
      attributionControl: false,
      logoPosition: "bottom-left",
    });

    // @ts-ignore
    (window as any).newMap = newMap;
    newMap.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "top-right"
    );

    setMap(newMap);
    // @ts-ignore
    (window as any).newMap = newMap;

    newMap.on("load", () => {
      newMap.setFog({
        range: [1, 5],
        color: "rgba(255, 255, 255, 0.4)",
        "horizon-blend": 0.1,
        "high-color": "rgba(55, 120, 255, 0.5)",
        "space-color": "rgba(0, 0, 0, 1)",
        "star-intensity": 0.5,
      });

      // Attach click interactions for case study layers
      caseStudies.forEach((c) => {
        const sourceName = slugify(c.r);
        // Prefer clicking on fill layers only to avoid duplicate events
        const fillLayerId = c.layers
          ? `${sourceName}-layer-0`
          : `${sourceName}-layer`;
        if (newMap.getLayer(fillLayerId)) {
          const onClick = () => {
            setFlashSlug(sourceName);
            const el = listItemRefs.current[sourceName];
            if (el) {
              const isMobile = window.matchMedia("(max-width: 767px)").matches;
              el.scrollIntoView({
                behavior: "smooth",
                block: isMobile ? "nearest" : "center",
                inline: isMobile ? "center" : "nearest",
              });
            }
            window.setTimeout(
              () => setFlashSlug((s) => (s === sourceName ? null : s)),
              1200
            );
          };
          const onEnter = () => {
            newMap.getCanvas().style.cursor = "pointer";
          };
          const onLeave = () => {
            newMap.getCanvas().style.cursor = "";
          };
          newMap.on("click", fillLayerId, onClick);
          newMap.on("mouseenter", fillLayerId, onEnter);
          newMap.on("mouseleave", fillLayerId, onLeave);
        }
      });

      // Interactions for regular projects points
      if (newMap.getLayer("projects-layer")) {
        const onClickProjects = (e: any) => {
          const feature = e.features && e.features[0];
          if (!feature) return;
          const name =
            (feature.properties && feature.properties.name) || "Project";
          const slug = (feature.properties && feature.properties.slug) || "";

          const container = document.createElement("div");
          container.style.minWidth = "180px";
          container.className = "";

          const title = document.createElement("div");
          title.textContent = String(name);
          title.style.fontWeight = "600";
          title.style.marginBottom = "4px";

          const link = document.createElement("a");
          link.href = `/${slug}/app`;
          link.textContent = "Open project →";
          link.className = "text-sky-500 hover:underline";

          container.appendChild(title);
          container.appendChild(link);

          new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            className: "text-black",
          })
            .setLngLat(e.lngLat)
            .setDOMContent(container)
            .addTo(newMap);
        };

        const onEnterProjects = () => {
          newMap.getCanvas().style.cursor = "pointer";
        };
        const onLeaveProjects = () => {
          newMap.getCanvas().style.cursor = "";
        };

        newMap.on("click", "projects-layer", onClickProjects);
        newMap.on("mouseenter", "projects-layer", onEnterProjects);
        newMap.on("mouseleave", "projects-layer", onLeaveProjects);
      }
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
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-slate-900 to-transparent z-0 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-black/50 to-transparent z-0 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent z-0 pointer-events-none xl:hidden"></div>
      <div
        className="absolute right-0 top-0 w-[440px] h-full z-0 pointer-events-none hidden xl:block"
        style={{
          background:
            "linear-gradient(to left, rgba(15, 23, 42, 1), rgba(15, 23, 42, 0.8) 80%,rgba(15, 23, 42, 0))",
        }}
      ></div>
      <ul
        ref={listContainerRef}
        className="absolute z-10 right-0 md:right-0 left-0 xl:left-auto bottom-0 xl:bottom-auto top-auto xl:top-0 w-full xl:w-96 h-40 xl:h-full overflow-x-auto xl:overflow-x-hidden xl:overflow-y-auto flex xl:block gap-3 xl:gap-0 xl:space-y-4 p-2 py-4 pointer-events-auto"
      >
        {caseStudies.map((c) => {
          const sourceName = slugify(c.r);
          const isFlashing = flashSlug === sourceName;
          return (
            <li
              key={c.r}
              ref={(el) => {
                listItemRefs.current[sourceName] = el;
              }}
              className={`flex items-center gap-4 rounded-xl px-3 py-3  border border-white/10 backdrop-blur-sm pointer-events-auto cursor-pointer bg-gradient-to-r from-slate-700/20 to-slate-700/50 hover:bg-gradient-to-br hover:to-slate-600/50 active:bg-gradient-to-t active:from-yellow-500/20 active:to-yellow-300/30 transition-colors shrink-0 w-72 xl:w-auto xl:shrink ${
                isFlashing
                  ? "bg-gradient-to-t from-yellow-500/20 to-yellow-300/30"
                  : ""
              }`}
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
                <p className="mt-1 text-sm text-slate-300 truncate">{c.o}</p>
                <div className="mt-2 flex gap-4 text-sm">
                  <a
                    className="text-sky-500 hover:underline"
                    href={c.caseStudyPath || "/case-studies"}
                  >
                    Case study →
                  </a>
                  <a
                    className="text-slate-300 hover:underline"
                    href={`/${c.slug}/app`}
                  >
                    Open project →
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
            <p
              className="mt-2 text-slate-100 max-w-2xl"
              style={{
                textShadow: "black 1px 0 8px",
              }}
            >
              SeaSketch is used in over 20 countries around the globe.
            </p>
          </div>
        </div>
      </div>
      <div className="absolute xl:bottom-8 right-2 xl:left-2 bottom-[150px] z-10 opacity-70">
        <img
          src="/GoogleMaps_Logo_White_4x.png"
          alt="Google Maps"
          className="h-5"
        />
      </div>
    </section>
  );
}
