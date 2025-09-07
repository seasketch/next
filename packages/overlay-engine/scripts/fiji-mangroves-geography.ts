import { SourceCache } from "fgb-source";
import {
  calculateGeographyOverlap,
  ClippingLayerOption,
} from "../src/geographies/geographies";

const mangrovesSource =
  "http://uploads.seasketch.org/testing:fiji-mangroves.fgb";

const FIJI_EEZ = [
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8325,
      ],
    },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
    op: "INTERSECT",
  },
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
    op: "DIFFERENCE",
    headerSizeHint: 38500000,
  },
] as ClippingLayerOption[];

const sourceCache = new SourceCache("200 MB");

calculateGeographyOverlap(
  FIJI_EEZ,
  sourceCache,
  mangrovesSource,
  "FlatGeobuf",
  undefined,
  {
    log: (message) => {
      console.log(message);
    },
    progress: async (progress, message) => {
      console.log(progress, message);
    },
  }
).then(console.log);
