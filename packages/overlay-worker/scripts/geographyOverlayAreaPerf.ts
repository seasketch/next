import { SourceCache } from "fgb-source";
import { calculateGeographyOverlap, ClippingLayerOption } from "overlay-engine";

// Reef-associated bioregions
const subdividedSource =
  "https://uploads.seasketch.org/projects/cburt/subdivided/149-90348c09-93c0-4957-ab07-615c0abf6099.fgb";

// Fiji EEZ, including complex shoreline clipping
const geography = [
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
    op: "DIFFERENCE",
  },
  {
    cql2Query: { op: "=", args: [{ property: "MRGID_EEZ" }, 8325] },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
    op: "INTERSECT",
  },
];

const payload = {
  type: "overlay_area",
  jobKey: "ddf54573-ae36-4faf-bed0-3adfa532b13b",
  subject: {
    type: "geography",
    id: 54,
    clippingLayers: geography,
  },
  groupBy: "Name",
  sourceUrl: subdividedSource,
  sourceType: "FlatGeobuf",
  queueUrl:
    "https://sqs.us-west-2.amazonaws.com/196230260133/seasketch-dev-overlay-engine-worker-queue-1",
};

const sourceCache = new SourceCache("128 mb");

calculateGeographyOverlap(
  payload.subject.clippingLayers as ClippingLayerOption[],
  sourceCache,
  subdividedSource,
  "FlatGeobuf",
  "Name",
  {
    log: (message) => {
      console.log(message);
    },
    progress: async (progress, message) => {
      console.log(progress, message);
    },
  }
).then(console.log);
