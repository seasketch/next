mapboxgl.accessToken = "local-demo";

const regionButtons = document.getElementById("regions");
const viewButtons = document.getElementById("views");
const note = document.querySelector(".note");
let map = null;
let regions = [];

function viewOf(view) {
  return { center: [view.lon, view.lat], zoom: view.zoom };
}

function markActive(id) {
  regionButtons.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("on", button.dataset.region === id);
  });
}

function showViews(region) {
  viewButtons.replaceChildren();
  for (const view of region.views) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = view.name;
    button.addEventListener("click", () => map && map.easeTo({ ...viewOf(view), duration: 600 }));
    viewButtons.appendChild(button);
  }
}

function placeMap(style) {
  const origin = location.origin;
  style.sprite = `${origin}/s57/sprite`;
  style.glyphs = `${origin}/s57/font/{fontstack}/{range}.pbf`;
  // The tile worker cannot resolve a root-relative URL. The local demo sends
  // absolute tile templates for the same reason.
  for (const source of Object.values(style.sources || {})) {
    if (!source.tiles) continue;
    source.tiles = source.tiles.map((tile) => (tile.startsWith("http") ? tile : origin + tile));
  }
  return style;
}

function watch(mapInstance) {
  mapInstance.on("error", (event) => {
    const message = event && event.error ? event.error.message : String(event);
    window.__chartErrors = window.__chartErrors || [];
    window.__chartErrors.push(message);
    console.error(message);
    if (note && /sprite|glyph|style/i.test(message)) note.textContent = message;
  });
}

function hashFor(view) {
  return `#${view.zoom}/${view.lat}/${view.lon}`;
}

function openRegion(id, settle) {
  const region = regions.find((candidate) => candidate.id === id) || regions[0];
  markActive(region.id);
  showViews(region);
  const openingView = settle && region.views[0] ? region.views[0] : null;
  // Write the opening camera into the hash before the style swaps. The map's
  // own hash handler otherwise keeps the previous view and the new coast
  // never comes into frame.
  const hash = openingView ? hashFor(openingView) : location.hash;
  history.replaceState(null, "", `?region=${encodeURIComponent(region.id)}${hash}`);
  return Promise.all([
    fetch(`/charts/${region.id}/chart.json`).then((response) => response.json()),
    fetch(`/charts/${region.id}/style.json`).then((response) => response.json()),
  ]).then(([chart, style]) => {
    placeMap(style);
    if (!map) {
      map = new mapboxgl.Map({
        container: "map",
        style: style,
        bounds: chart.bounds,
        hash: true,
        fadeDuration: 0,
        attributionControl: true,
      });
      watch(map);
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.addControl(new mapboxgl.ScaleControl({ maxWidth: 160, unit: "nautical" }), "bottom-left");
      map.on("load", () => {
        if (openingView) map.jumpTo(viewOf(openingView));
        else if (!location.hash && region.views[0]) map.jumpTo(viewOf(region.views[0]));
      });
      window.map = map;
      return;
    }
    if (openingView) map.jumpTo(viewOf(openingView));
    map.setStyle(style);
    map.once("style.load", () => {
      if (openingView) map.jumpTo(viewOf(openingView));
    });
  });
}

async function tilesReady() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This chart page needs a service worker to read the tile archives.");
  }
  const version = "__SW_VERSION__";
  const expected = new URL(`/sw.js?v=${version}`, location.origin).href;
  const registration = await navigator.serviceWorker.register(`/sw.js?v=${version}`, { updateViaCache: "none" });
  const incoming = registration.installing || registration.waiting;
  if (incoming) {
    await new Promise((resolve) => {
      if (incoming.state === "activated") {
        resolve();
        return;
      }
      incoming.addEventListener("statechange", () => {
        if (incoming.state === "activated") resolve();
      });
    });
  }
  const current = () => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL;
  if (current() === expected) return;
  await new Promise((resolve) => {
    if (current() === expected) {
      resolve();
      return;
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (current() === expected) resolve();
    });
  });
}

tilesReady()
  .then(() => fetch("/regions.json"))
  .then((response) => response.json())
  .then((listed) => {
    regions = listed;
    const requested = new URLSearchParams(location.search).get("region");
    for (const region of regions) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.region = region.id;
      button.textContent = region.title;
      button.title = region.note || region.title;
      button.addEventListener("click", () => openRegion(region.id, true));
      regionButtons.appendChild(button);
    }
    return openRegion(requested || (regions[0] && regions[0].id), false);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (note) note.textContent = message;
    console.error(message);
  });
