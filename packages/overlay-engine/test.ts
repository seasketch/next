import { SourceCache } from "fgb-source";
import { calculateArea, ClippingLayerOption } from "./src";
import https from "https";

// Fiji offshore
const FIJI_OFFSHORE = [
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
const US_EEZ = [
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
      "https://uploads.seasketch.org/projects/superuser/public/04620ab4-5550-4858-b827-9ef41539376b.fgb",
    op: "INTERSECT",
  },
  {
    cql2Query: null,
    source:
      "https://uploads.seasketch.org/projects/superuser/public/5dee67d7-83ea-4755-be22-afefc22cbee3.fgb",
    op: "DIFFERENCE",
  },
] as ClippingLayerOption[];

const sourceCache = new SourceCache("200 MB", {
  // implement using node built in http client
  fetchRangeFn: async (url, range) => {
    return new Promise((resolve, reject) => {
      console.log("fetching range", range);

      // Handle null range end (means to end of file)
      const rangeEnd = range[1] !== null ? range[1] : "";
      const rangeHeader =
        rangeEnd !== ""
          ? `bytes=${range[0]}-${rangeEnd}`
          : `bytes=${range[0]}-`;

      const request = https.get(url, {
        headers: {
          Range: rangeHeader,
        },
      });

      // Set 10 second timeout
      const timeout = setTimeout(() => {
        request.destroy();
        reject(
          new Error(
            `Request timeout after 60 seconds for range ${range}. Size: ${
              range[1] - range[0]
            }`
          )
        );
      }, 60000);

      const chunks: Buffer[] = [];
      request.on("response", (response) => {
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          clearTimeout(timeout);
          const buffer = Buffer.concat(chunks);
          resolve(
            buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength
            )
          );
        });
      });
      request.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  },
});

(async () => {
  const area = await calculateArea(US_EEZ, sourceCache);
  console.log(area);
})();
