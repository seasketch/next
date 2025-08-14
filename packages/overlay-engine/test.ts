import { SourceCache } from "fgb-source";
import { calculateArea, ClippingLayerOption } from "./src";

// Fiji offshore
const clippingLayers = [
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
      "https://uploads.seasketch.org/projects/superuser/public/b81f1e78-5e8e-4161-8c4a-03aea87c311a.fgb",
    op: "DIFFERENCE",
  },
] as ClippingLayerOption[];

// US EEZ
// const clippingLayers = [
//   {
//     cql2Query: {
//       op: "=",
//       args: [
//         {
//           property: "MRGID_EEZ",
//         },
//         8456,
//       ],
//     },
//     source:
//       "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
//     op: "INTERSECT",
//   },
//   {
//     cql2Query: null,
//     source:
//       "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
//     op: "DIFFERENCE",
//   },
// ] as ClippingLayerOption[];

const sourceCache = new SourceCache("200 MB");

(async () => {
  const area = await calculateArea(clippingLayers, sourceCache);
  console.log(area);
})();
