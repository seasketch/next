import { SourceCache } from "fgb-source";
import {
  calculateArea,
  ClippingLayerOption,
  CalculateAreaOptions,
  DebuggingCallback,
} from "./src";
import https from "https";
import { DebuggingFgbWriter } from "./src/utils/debuggingFgbWriter";

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

// Fiji EEZ
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
    headerSizeHint: 38500000,
  },
] as ClippingLayerOption[];

// HAWAII EEZ
const HAWAII_EEZ = [
  {
    cql2Query: {
      op: "=",
      args: [
        {
          property: "MRGID_EEZ",
        },
        8453,
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
    headerSizeHint: 38500000,
  },
] as ClippingLayerOption[];

const sourceCache = new SourceCache("200 MB", {
  // implement using node built in http client
  fetchRangeFn: async (url, range) => {
    return new Promise((resolve, reject) => {
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
      // Set 120 second timeout
      const timeout = setTimeout(() => {
        request.destroy();
        reject(
          new Error(
            `Request timeout after 120 seconds for range ${range}. Size: ${
              range[1] - range[0]
            }`
          )
        );
      }, 120000);
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

// Create debugging callback that saves features to FGB files
function createDebuggingCallback(): {
  callback: DebuggingCallback;
  cleanup: () => Promise<void>;
} {
  const classifiedLand = new DebuggingFgbWriter(
    "/Users/cburt/Downloads/classified.fgb",
    [
      { name: "__offset", type: "integer" },
      { name: "class", type: "string" },
    ]
  );
  const intersectionWriter = new DebuggingFgbWriter(
    "/Users/cburt/Downloads/intersection.fgb",
    [{ name: "name", type: "string" }]
  );
  const bboxesWriter = new DebuggingFgbWriter(
    "/Users/cburt/Downloads/bboxes.fgb",
    []
  );

  const callback: DebuggingCallback = (type, feature) => {
    try {
      switch (type) {
        case "edge-box":
          bboxesWriter.addFeature(feature);
          break;
        case "classified-difference-feature":
          classifiedLand.addFeature(feature);
          break;
        case "intersection-layer":
          intersectionWriter.addFeature(feature);
          break;
      }
    } catch (error) {
      console.error(`Error writing ${type} feature:`, error);
    }
  };

  const cleanup = async () => {
    try {
      await classifiedLand.close();
      await intersectionWriter.close();
      await bboxesWriter.close();
      console.log("All debugging writers closed successfully");
    } catch (error) {
      console.error("Error closing writers:", error);
    }
  };

  return { callback, cleanup };
}

(async () => {
  try {
    // Create debugging callback if debugging is needed
    const { callback: debuggingCallback, cleanup } = createDebuggingCallback();

    const options: CalculateAreaOptions = {
      debuggingCallback,
      progressCallback: (progress: number) => {
        console.log(`Progress: ${progress}%`);
      },
    };

    const area = await calculateArea(HAWAII_EEZ, sourceCache, options);
    console.log(area);

    // Cleanup debugging writers
    await cleanup();
  } catch (error) {
    console.error("Error:", error);
  }
})();
