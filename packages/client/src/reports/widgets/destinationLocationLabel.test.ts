import { destinationLocationLabel, pathCollection } from "./DistancePathMap";
import { Feature, LineString } from "geojson";

function shorePath(): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  };
}

describe("pathCollection", () => {
  it("keeps a distance label on every shore point", () => {
    const collection = pathCollection(
      [shorePath(), shorePath()],
      ["12 km", "12 km"]
    );
    const labels = collection.features
      .filter((feature) => feature.properties?.kind === "destination")
      .map((feature) => feature.properties?.label);
    expect(labels).toEqual(["12 km", "12 km"]);
  });

  it("labels a shared place once when routes carry their own distances", () => {
    const collection = pathCollection(
      [shorePath(), shorePath()],
      ["APIA", "APIA"],
      ["169 km", "6.74 km"]
    );
    const labels = collection.features
      .filter((feature) => feature.properties?.kind === "destination")
      .map((feature) => feature.properties?.label);
    expect(labels[0]).toBe("APIA\n6.74 km\n169 km");
    expect(labels[1]).toBe("");
  });

  it("draws a shoreline and a route in one collection", () => {
    const collection = pathCollection(
      [shorePath(), shorePath()],
      ["Touches shoreline", "4 km"],
      undefined,
      [false, true]
    );
    const kinds = collection.features.map(
      (feature) => feature.properties?.kind
    );
    expect(kinds).toContain("shoreline");
    expect(kinds).toContain("path");
    expect(kinds).toContain("destination");
  });
});

describe("destinationLocationLabel", () => {
  it("appends the distance when one route ends at the place", () => {
    expect(destinationLocationLabel("APIA", ["169 km"])).toBe("APIA\n169 km");
  });

  it("lists two distances on separate lines, shortest first", () => {
    expect(destinationLocationLabel("APIA", ["169 km", "6.74 km"])).toBe(
      "APIA\n6.74 km\n169 km"
    );
  });

  it("leaves the place name alone when more than two routes end there", () => {
    expect(
      destinationLocationLabel("APIA", ["169 km", "6.74 km", "40 km"])
    ).toBe("APIA");
  });

  it("does not invent a label when the place has no name", () => {
    expect(destinationLocationLabel("", ["12 km"])).toBe("");
  });
});
