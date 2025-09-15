/* eslint-disable i18next/no-literal-string */
import mapboxgl, { AnyLayer, GeoJSONSourceRaw } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import slugify from "slugify";
import { caseStudies } from "./caseStudies";
import {
  useProjectListingQuery,
  useWhereWeWorkQuery,
} from "../generated/graphql";

const GOOGLE_MAPS_TILE_URL =
  "https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}";

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<any>;
};

export default function ProjectsMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  // Get Google Maps 2D tiles session
  const { data: whereData } = useWhereWeWorkQuery();

  // Fetch a large page of projects for map points
  const { data: projectsData } = useProjectListingQuery({
    variables: { first: 500 },
    fetchPolicy: "cache-and-network",
    returnPartialData: true,
  });

  const projectsFC: FeatureCollection = useMemo(() => {
    const edges = projectsData?.projects?.edges ?? [];
    const features: any[] = [];
    for (const edge of edges) {
      const p = edge?.node as any;
      if (!p?.centerGeojson) continue;
      try {
        const geom =
          typeof p.centerGeojson === "string"
            ? JSON.parse(p.centerGeojson)
            : p.centerGeojson;
        if (!geom) continue;
        features.push({
          type: "Feature",
          geometry: geom,
          properties: {
            name: p.name,
            slug: p.slug,
          },
        });
      } catch (_) {
        // ignore invalid
      }
    }
    return { type: "FeatureCollection", features };
  }, [projectsData?.projects?.edges]);

  useEffect(() => {
    // @ts-ignore
    if ((map && !map._removed) || !mapRef.current) return;
    const session = whereData?.gmapssatellitesession?.session;
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
            tileSize: 512,
          },
          projects: {
            type: "geojson",
            data: projectsFC as any,
          } as GeoJSONSourceRaw,
          ...caseStudies
            .filter((c) => c.tilejson && c.sourceLayer)
            .reduce((sources, c) => {
              sources[slugify(c.r)] = {
                type: "vector",
                url: c.tilejson!,
              } as any;
              return sources;
            }, {} as any),
          ...caseStudies
            .filter((c) => c.geojson)
            .reduce((sources, c) => {
              sources[slugify(c.r)] = {
                type: "geojson",
                data: c.geojson!,
              } as any;
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
      logoPosition: "top-left",
    });

    setMap(newMap);
    newMap.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "top-right"
    );

    newMap.on("load", () => {
      newMap.setFog({
        range: [1, 5],
        color: "rgba(255, 255, 255, 0.4)",
        "horizon-blend": 0.1,
        "high-color": "rgba(55, 120, 255, 0.5)",
        "space-color": "rgba(0, 0, 0, 1)",
        "star-intensity": 0.5,
      });

      // Case study layer clicks -> popup with links
      caseStudies.forEach((c) => {
        const sourceName = slugify(c.r);
        const fillLayerId = c.layers
          ? `${sourceName}-layer-0`
          : `${sourceName}-layer`;
        if (newMap.getLayer(fillLayerId)) {
          const onClick = (e: any) => {
            const container = document.createElement("div");
            container.className = "text-black font-bold";
            container.style.minWidth = "200px";
            const title = document.createElement("div");
            title.textContent = c.r;
            title.style.fontWeight = "600";
            title.style.marginBottom = "6px";

            const links = document.createElement("div");
            links.style.display = "flex";
            links.style.gap = "12px";

            const app = document.createElement("a");
            app.href = `/${c.slug}/app`;
            app.textContent = "Open project →";
            app.className = "text-sky-500 hover:underline";

            const cs = document.createElement("a");
            cs.href = c.caseStudyPath || "/case-studies";
            cs.textContent = "Case study →";
            cs.className = "text-slate-600 hover:underline";

            links.appendChild(app);
            links.appendChild(cs);
            container.appendChild(title);
            container.appendChild(links);

            new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat(e.lngLat)
              .setDOMContent(container)
              .addTo(newMap);
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

      // Project point clicks
      if (newMap.getLayer("projects-layer")) {
        const onClickProjects = (e: any) => {
          const feature = e.features && e.features[0];
          if (!feature) return;
          const name =
            (feature.properties && feature.properties.name) || "Project";
          const slug = (feature.properties && feature.properties.slug) || "";

          const container = document.createElement("div");
          container.style.minWidth = "180px";

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

          new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
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
  }, [whereData?.gmapssatellitesession?.session, mapRef]);

  // Update projects source when data changes
  useEffect(() => {
    if (!map) return;
    // @ts-ignore
    if (map._removed) return;
    const src = map.getSource("projects") as any;
    if (src && typeof src.setData === "function") {
      try {
        src.setData(projectsFC as any);
      } catch (_) {
        // ignore
      }
    }
  }, [map, projectsFC]);

  return (
    <section className="relative h-128 bg-slate-900">
      <div ref={mapRef} className="w-full h-full absolute top-0 left-0 z-0" />
      <div className="absolute xl:top-4 xl:right-4 right-2 top-2 opacity-70">
        <img
          src="/GoogleMaps_Logo_White_4x.png"
          alt="Google Maps"
          className="h-5"
        />
      </div>
      <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-slate-900/70 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-1/4 bg-gradient-to-t from-slate-800 to-transparent via-slate-800/90 z-10 pointer-events-none"></div>
    </section>
  );
}
