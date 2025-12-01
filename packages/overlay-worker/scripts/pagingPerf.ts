import { SourceCache } from "fgb-source";
import { setGlobalDispatcher, Agent, fetch } from "undici";

// Create one agent per container at module load
const agent = new Agent({
  keepAliveTimeout: 30_000, // how long to keep idle sockets
  keepAliveMaxTimeout: 60_000,
  connections: 50, // max sockets total (tune as needed)
});
setGlobalDispatcher(agent);

// Reef-associated bioregions
const subdividedSource =
  "https://uploads.seasketch.org/projects/cburt/subdivided/149-90348c09-93c0-4957-ab07-615c0abf6099.fgb";

// CA Study regions (5 multipolygons)
// const subdividedSource =
//   "https://uploads.seasketch.org/projects/cburt/public/3a02d7df-b2f1-4b45-8ea5-5664bd4c5475.fgb";

const sourceCache = new SourceCache("1GB", {
  fetchRangeFn: (url, range) => {
    return fetch(url, {
      headers: { Range: `bytes=${range[0]}-${range[1] ? range[1] : ""}` },
    }).then((response) => {
      return response.arrayBuffer();
    });
  },
  maxCacheSize: "256MB",
});

async function main() {
  const source = await sourceCache.get(subdividedSource, {
    pageSize: "2MB",
  });

  const bbox = {
    minX: -180,
    minY: -90,
    maxX: 180,
    maxY: 90,
  };

  let featureCount = 0;
  for await (const feature of source.getFeaturesAsync(bbox)) {
    // console.log(feature);
    featureCount++;
  }
  console.log(`featureCount: ${featureCount}`);
}

main().catch(console.error);
