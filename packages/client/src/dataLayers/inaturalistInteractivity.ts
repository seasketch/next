/* eslint-disable i18next/no-literal-string */
import i18next from "i18next";
import mapboxgl, { Map, Popup } from "mapbox-gl";
import { MapMouseEvent } from "mapbox-gl";
import {
  InaturalistQueryParams,
  buildInaturalistQueryString,
  normalizeInaturalistParams,
} from "./inaturalist";

type Dataset = "grid" | "points";

type UtfgridResult = {
  data: Record<string, any>;
  lngLat: mapboxgl.LngLat;
  dataset: Dataset;
  params: InaturalistQueryParams;
  layerLabel?: string;
};

const utfgridCache: Record<
  string,
  { grid: string[]; keys: string[]; data: Record<string, any> }
> = {};

export function getInaturalistDatasetForZoom(
  params: InaturalistQueryParams,
  zoom: number
): Dataset | null {
  if (params.type === "grid") {
    return "grid";
  }
  if (params.type === "points") {
    return "points";
  }
  if (params.type === "heatmap") {
    return null;
  }
  if (params.type === "grid+points") {
    return Math.floor(zoom) < params.zoomCutoff ? "grid" : "points";
  }
  if (params.type === "heatmap+points") {
    return Math.floor(zoom) >= params.zoomCutoff ? "points" : null;
  }
  return null;
}

export async function fetchInaturalistUtfgrid(
  map: Map,
  rawParams: Partial<InaturalistQueryParams>,
  e: MapMouseEvent & mapboxgl.EventData,
  layerLabel?: string
): Promise<UtfgridResult | null> {
  const params = normalizeInaturalistParams(rawParams);
  const dataset = getInaturalistDatasetForZoom(params, map.getZoom());
  if (!dataset) {
    return null;
  }

  const { lng, lat } = e.lngLat;
  const zoom = Math.floor(map.getZoom());
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;
  const xFloat = ((lng + 180) / 360) * n;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const xTile = Math.floor(xFloat);
  const yTile = Math.floor(yFloat);
  const xPixel = Math.floor((xFloat - xTile) * 256);
  const yPixel = Math.floor((yFloat - yTile) * 256);

  const queryString = buildInaturalistQueryString(params);
  const tileKey = `${dataset}:${zoom}:${xTile}:${yTile}:${queryString}`;
  const url = `https://api.inaturalist.org/v1/${dataset}/${zoom}/${xTile}/${yTile}.grid.json${queryString}`;

  try {
    let json = utfgridCache[tileKey];
    if (!json) {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      json = (await response.json()) as {
        grid: string[];
        keys: string[];
        data: Record<string, any>;
      };
      if (!json.grid || !json.grid.length || !json.keys) {
        return null;
      }
      utfgridCache[tileKey] = json;
    }

    const gridSize = json.grid.length;
    const resolution = 256 / gridSize;
    const row = Math.floor(yPixel / resolution);
    const col = Math.floor(xPixel / resolution);

    if (
      row < 0 ||
      row >= json.grid.length ||
      col < 0 ||
      col >= json.grid[row].length
    ) {
      return null;
    }

    const char = json.grid[row].charAt(col);
    const code = char.charCodeAt(0);
    let idx = code - 32;
    if (code >= 93) {
      idx--;
    }
    if (code >= 35) {
      idx--;
    }

    const key = json.keys[idx];
    const data = key ? json.data[key] : null;
    if (!data) {
      return null;
    }

    return { data, lngLat: e.lngLat, dataset, params, layerLabel };
  } catch {
    return null;
  }
}

export async function renderInaturalistPopup(
  map: Map,
  result: UtfgridResult
): Promise<Popup> {
  const { data, lngLat, dataset, params } = result;
  const t = i18next.t.bind(i18next);

  const container = document.createElement("div");

  const headerLabel = result.layerLabel;
  const appendHeader = (parent: HTMLElement, className?: string) => {
    if (!headerLabel) return;
    const header = document.createElement("div");
    header.textContent = headerLabel;
    header.className = className || "";
    header.style.fontSize = "12px";
    header.style.lineHeight = "1.2";
    header.style.fontWeight = "600";
    header.style.marginBottom = "6px";
    parent.appendChild(header);
  };

  if (dataset === "grid") {
    container.style.backgroundColor = "#ff6600";
    container.style.color = "#ffffff";
    container.style.padding = "12px 16px";
    container.style.borderRadius = "4px";
    container.style.textAlign = "center";

    appendHeader(container);

    const count =
      (data && typeof data.cellCount === "number" && data.cellCount) ||
      (data && typeof data.cell_count === "number" && data.cell_count);

    const text = document.createElement("div");
    text.style.fontSize = "18px";
    text.style.lineHeight = "1.2";
    text.style.fontWeight = "700";
    const countLabel =
      count.toLocaleString() +
      " " +
      (typeof count === "number"
        ? count === 1
          ? t("Observation", { ns: "admin:data" })
          : t("Observations", { count, ns: "admin:data" })
        : t("Observations", { ns: "admin:data" }));
    text.textContent = countLabel;
    container.appendChild(text);

    if (params.type === "grid+points") {
      const hint = document.createElement("div");
      hint.style.fontSize = "12px";
      hint.style.lineHeight = "1.4";
      hint.style.fontWeight = "400";
      hint.style.marginTop = "8px";
      hint.style.opacity = "0.9";
      hint.textContent = t("Zoom in to visualize point locations", {
        ns: "admin:data",
      });
      container.appendChild(hint);
    }
  } else {
    container.className = "text-xs w-80";

    appendHeader(container, "mb-2");

    const body = document.createElement("div");
    body.className = "flex space-x-2 max-w-full overflow-hidden";

    const imageWrapper = document.createElement("div");
    imageWrapper.className =
      "w-24 h-24 flex-shrink-0 bg-gray-200 overflow-hidden";
    const imageLink = document.createElement("a");
    imageLink.target = "_blank";
    imageLink.rel = "noopener noreferrer";
    const imageEl = document.createElement("img");
    imageEl.className = "w-full h-full object-cover";
    imageLink.appendChild(imageEl);
    imageWrapper.appendChild(imageLink);

    const content = document.createElement("div");
    content.className = "flex-1 max-w-full overflow-hidden";

    const commonNameLink = document.createElement("a");
    commonNameLink.className = "font-semibold text-sm mb-0.5 truncate block";
    commonNameLink.style.color = "inherit";
    commonNameLink.style.textDecoration = "none";
    commonNameLink.target = "_blank";
    commonNameLink.rel = "noopener noreferrer";
    commonNameLink.textContent = t("Loading observation…", {
      ns: "admin:data",
    });

    const scientificNameEl = document.createElement("div");
    scientificNameEl.className = "text-xs italic text-gray-700 mb-0.5 truncate";

    const locationEl = document.createElement("div");
    locationEl.className = "text-xs text-gray-700 mb-0.5 truncate";

    const dateEl = document.createElement("div");
    dateEl.className = "text-xs text-gray-500";

    const linkEl = document.createElement("a");
    linkEl.className = "mt-2 inline-block text-xs underline";
    linkEl.style.color = "#74ac00";
    linkEl.target = "_blank";
    linkEl.rel = "noopener noreferrer";

    content.appendChild(commonNameLink);
    content.appendChild(scientificNameEl);
    content.appendChild(locationEl);
    content.appendChild(dateEl);
    content.appendChild(linkEl);

    body.appendChild(imageWrapper);
    body.appendChild(content);
    container.appendChild(body);

    const uuid = data && typeof data.uuid === "string" ? data.uuid : undefined;

    if (uuid) {
      (async () => {
        try {
          const obsUrl = `https://api.inaturalist.org/v2/observations/${encodeURIComponent(
            uuid
          )}?locale=en-US&fields=(comments_count%3A!t%2Ccreated_at%3A!t%2Ccreated_at_details%3Aall%2Ccreated_time_zone%3A!t%2Cfaves_count%3A!t%2Cgeoprivacy%3A!t%2Cid%3A!t%2Cidentifications%3A(current%3A!t)%2Cidentifications_count%3A!t%2Clocation%3A!t%2Cmappable%3A!t%2Cobscured%3A!t%2Cobserved_on%3A!t%2Cobserved_on_details%3Aall%2Cobserved_time_zone%3A!t%2Cphotos%3A(id%3A!t%2Curl%3A!t)%2Cplace_guess%3A!t%2Cprivate_geojson%3A!t%2Cquality_grade%3A!t%2Csounds%3A(id%3A!t)%2Ctaxon%3A(iconic_taxon_id%3A!t%2Cname%3A!t%2Cpreferred_common_name%3A!t%2Cpreferred_common_names%3A(name%3A!t)%2Crank%3A!t%2Crank_level%3A!t)%2Ctime_observed_at%3A!t%2Cuser%3A(icon_url%3A!t%2Cid%3A!t%2Clogin%3A!t))`;

          const resp = await fetch(obsUrl);
          if (!resp.ok) {
            return;
          }
          const json = (await resp.json()) as {
            results?: any[];
          };
          const obs = json.results && json.results[0];
          if (!obs) {
            return;
          }

          const taxon = obs.taxon || {};
          const commonName: string =
            taxon.preferred_common_name ||
            (Array.isArray(taxon.preferred_common_names) &&
              taxon.preferred_common_names[0]?.name) ||
            taxon.name ||
            t("Unknown taxon", { ns: "admin:data" });
          const scientificName: string =
            taxon.name && typeof taxon.name === "string" ? taxon.name : "";

          commonNameLink.textContent = commonName;
          scientificNameEl.textContent = scientificName
            ? `(${scientificName})`
            : "";

          if (obs.place_guess && typeof obs.place_guess === "string") {
            locationEl.textContent = obs.place_guess;
          } else {
            locationEl.textContent = "";
          }

          const dateSource: string | null =
            (obs.observed_on as string | null) ||
            (obs.time_observed_at as string | null) ||
            (obs.created_at as string | null) ||
            null;
          if (dateSource) {
            const date = new Date(dateSource);
            const formatted = date.toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            dateEl.textContent = formatted;
          } else {
            dateEl.textContent = "";
          }

          if (Array.isArray(obs.photos) && obs.photos.length > 0) {
            const photo = obs.photos[0];
            if (photo.url && typeof photo.url === "string") {
              const url: string = photo.url.replace("square", "medium");
              imageEl.src = url;
              imageEl.alt = commonName;
            }
          }

          if (typeof obs.id === "number") {
            const observationUrl = `https://www.inaturalist.org/observations/${obs.id}`;
            linkEl.href = observationUrl;
            linkEl.textContent = t("View on iNaturalist", { ns: "admin:data" });
            imageLink.href = observationUrl;
            commonNameLink.href = observationUrl;
          }
        } catch {
          // ignore
        }
      })();
    } else {
      container.className = "text-xs";
      container.innerHTML = "";
      const title = document.createElement("div");
      title.className = "font-semibold mb-1";
      title.textContent = "iNaturalist Observations";
      container.appendChild(title);

      const list = document.createElement("dl");
      list.className = "space-y-0.5";
      Object.entries(data).forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.className = "font-mono text-gray-600";
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.className = "text-gray-800 break-words";
        dd.textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2);
        list.appendChild(dt);
        list.appendChild(dd);
      });
      container.appendChild(list);
    }
  }

  const popup = new Popup({
    closeButton: true,
    closeOnClick: true,
    className: "!max-w-128",
  })
    .setLngLat(lngLat)
    .setDOMContent(container)
    .addTo(map);

  return popup;
}
