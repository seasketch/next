/* eslint-disable @typescript-eslint/no-var-requires */
// One-off verification script for raster_overlay_area buffered overcount
// estimates. Replicates the overlay-worker pipeline for the "Mangrove test 2"
// sketch (2 disjoint fragments) and compares the combine-time overcount
// estimate against ground truth computed from buffer(A) ∩ buffer(B).
//
// Usage: node scripts/verify-raster-overcount.js <fragments.geojson> <bufferKm>

const fs = require("fs");
const engine = require("../dist/index.js");
const { computeBufferedSubjectAndCollar } = require("../dist/metrics/computeSubjectCollar.js");
const turfBuffer = require("@turf/buffer").default;
const turfArea = require("@turf/area").default;
const calcBBox = require("@turf/bbox").default;
const clipping = require("polyclip-ts");
const proj4 = require("proj4").default || require("proj4");

const SOURCE_URL =
  "http://uploads.seasketch.org/testing-mangroves-2020-subdivided.tif";
const EPSG = 3857;

function reproject(feature) {
  const t = proj4("EPSG:4326", "EPSG:3857");
  const mapRing = (ring) => ring.map(([x, y]) => t.forward([x, y]));
  const geom = JSON.parse(JSON.stringify(feature.geometry));
  if (geom.type === "Polygon") {
    geom.coordinates = geom.coordinates.map(mapRing);
  } else if (geom.type === "MultiPolygon") {
    geom.coordinates = geom.coordinates.map((poly) => poly.map(mapRing));
  } else {
    throw new Error("unsupported geometry " + geom.type);
  }
  return { type: "Feature", properties: {}, geometry: geom };
}

async function computeValue(featureWgs, { collarWgs, bufferKm } = {}) {
  const wgsBBox = calcBBox(featureWgs, { recompute: true });
  const centerLonLat = [
    (wgsBBox[0] + wgsBBox[2]) / 2,
    (wgsBBox[1] + wgsBBox[3]) / 2,
  ];
  const fragmentAreaSqM = turfArea(featureWgs);
  const projected = reproject(featureWgs);
  const options = {
    vrm: "auto",
    centerLonLat,
    fragmentAreaSqM,
    groupByValue: false,
  };
  if (collarWgs) {
    options.collar = {
      feature: reproject(collarWgs),
      bbox: wgsBBox,
      bufferKm,
    };
  }
  return engine.calculateRasterOverlayArea(SOURCE_URL, projected, options);
}

function toMultiPolygonFeature(coords) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: coords },
  };
}

async function main() {
  const fragmentsPath = process.argv[2];
  const bufferKm = Number(process.argv[3]);
  const fc = JSON.parse(fs.readFileSync(fragmentsPath, "utf-8"));
  const fragments = fc.features;
  console.log(
    `${fragments.length} fragments, buffer ${bufferKm} km, source ${SOURCE_URL}`,
  );

  // --- Replicate worker pipeline per fragment ---
  const values = [];
  const bufferedFeatures = [];
  const collarFeatures = [];
  for (const frag of fragments) {
    const { buffered, collar, bbox } = computeBufferedSubjectAndCollar(
      frag,
      bufferKm,
    );
    bufferedFeatures.push(buffered);
    collarFeatures.push(collar);
    const value = await computeValue(buffered, { collarWgs: collar, bufferKm });
    values.push(value);
    console.log(
      `fragment ${frag.properties?.hash?.slice(0, 8)}: areas=${JSON.stringify(
        value.areas,
      )} collar=${JSON.stringify(value.overlap?.collarAreas)} bboxAreaKm2=${value.overlap?.bboxAreaKm2?.toFixed(3)}`,
    );
  }

  const combined = engine.combineRasterOverlayAreaMetrics(values);
  console.log("\n--- combine result ---");
  console.log(JSON.stringify(combined.overlap, null, 2));
  console.log("combined areas:", JSON.stringify(combined.areas));

  // --- Ground truth ---
  const unionCoords = clipping.union(
    bufferedFeatures[0].geometry.coordinates,
    bufferedFeatures[1].geometry.coordinates,
  );
  const unionFeature = toMultiPolygonFeature(unionCoords);
  const unionValue = await computeValue(unionFeature);

  const intCoords = clipping.intersection(
    bufferedFeatures[0].geometry.coordinates,
    bufferedFeatures[1].geometry.coordinates,
  );
  let intersectionValue = { areas: { "*": 0 } };
  let intersectionFeature = null;
  if (intCoords && intCoords.length) {
    intersectionFeature = toMultiPolygonFeature(intCoords);
    intersectionValue = await computeValue(intersectionFeature);
  }

  // habitat in collarA ∩ collarB — the theoretically tight hard ceiling
  const collarIntCoords = clipping.intersection(
    collarFeatures[0].geometry.coordinates,
    collarFeatures[1].geometry.coordinates,
  );
  let collarIntValue = { areas: { "*": 0 } };
  if (collarIntCoords && collarIntCoords.length) {
    collarIntValue = await computeValue(
      toMultiPolygonFeature(collarIntCoords),
    );
  }

  const naive = (values[0].areas["*"] ?? 0) + (values[1].areas["*"] ?? 0);
  const unionTotal = unionValue.areas["*"] ?? 0;
  const trueOvercountViaUnion = naive - unionTotal;
  const trueOvercountDirect = intersectionValue.areas["*"] ?? 0;

  console.log("\n--- ground truth ---");
  console.log(`naive sum (A+B):                    ${naive.toFixed(4)} km²`);
  console.log(`union(buffer A, buffer B) habitat:  ${unionTotal.toFixed(4)} km²`);
  console.log(`TRUE overcount (naive − union):     ${trueOvercountViaUnion.toFixed(4)} km²`);
  console.log(`TRUE overcount (habitat in A∩B):    ${trueOvercountDirect.toFixed(4)} km²`);
  console.log(`habitat in collarA ∩ collarB:       ${(collarIntValue.areas["*"] ?? 0).toFixed(4)} km²`);
  const pc = combined.overlap?.perClass?.["*"];
  if (pc) {
    console.log("\n--- engine estimate vs truth ---");
    console.log(`engine overcountEstimate: ${pc.overcountEstimate.toFixed(4)} km² (${((pc.overcountEstimate / naive) * 100).toFixed(1)}% of naive)`);
    console.log(`engine overcountMax:      ${pc.overcountMax.toFixed(4)} km² (${((pc.overcountMax / naive) * 100).toFixed(1)}% of naive)`);
    console.log(`true overcount:           ${trueOvercountDirect.toFixed(4)} km² (${((trueOvercountDirect / naive) * 100).toFixed(1)}% of naive)`);
  } else {
    console.log("\nno overlap metadata on combine result");
  }

  // Save geometries for optional GDAL cross-check
  fs.writeFileSync(
    "/tmp/verify-overcount-geoms.json",
    JSON.stringify(
      {
        bufferedA: bufferedFeatures[0],
        bufferedB: bufferedFeatures[1],
        union: unionFeature,
        intersection: intersectionFeature,
      },
      null,
      2,
    ),
  );
  console.log("\ngeoms saved to /tmp/verify-overcount-geoms.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
