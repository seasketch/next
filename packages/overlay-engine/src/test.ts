import { SourceCache } from "fgb-source";
import { ClippingLayerOption } from "./geographies/geographies";
import { calculateArea } from "./geographies/calculateArea";

const FijiEEZ = [
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
    op: "DIFFERENCE",
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
      "https://uploads.seasketch.org/projects/superuser/public/9f969bf7-a3a9-4289-85ad-97e049faca07.fgb",
    op: "INTERSECT",
  },
] as ClippingLayerOption[];

const FSMEEZ = [
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8316,
      ],
    },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/9f969bf7-a3a9-4289-85ad-97e049faca07.fgb",
    op: "INTERSECT",
  },
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
    op: "DIFFERENCE",
  },
] as ClippingLayerOption[];

const USEEZ = [
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/8a1adc53-7e67-436a-9b19-3318b8b14ad2.fgb",
    op: "DIFFERENCE",
  },
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8456,
      ],
    },
    source:
      "https://uploads.seasketch.org/projects/superuser/public/9f969bf7-a3a9-4289-85ad-97e049faca07.fgb",
    op: "INTERSECT",
  },
] as ClippingLayerOption[];

const sourceCache = new SourceCache("128mb", {
  overfetchBytes: 2_000_000,
});
calculateArea(USEEZ, sourceCache).then(console.log);
