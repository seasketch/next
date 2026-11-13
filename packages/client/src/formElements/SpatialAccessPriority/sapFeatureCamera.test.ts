import { drawnFeatureCamera } from "./sapFeatureCamera";

const polygon = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};

const point = {
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "Point" as const,
    coordinates: [10, 20],
  },
};

describe("drawnFeatureCamera", () => {
  it("fits a polygon to its bounds", () => {
    expect(drawnFeatureCamera(polygon, { padding: 20, animate: false })).toEqual(
      {
        type: "fit",
        bounds: [0, 0, 1, 1],
        padding: 20,
        animate: false,
      }
    );
  });

  it("centers a point instead of fitting a zero-area box", () => {
    expect(drawnFeatureCamera(point, { padding: 50, animate: false })).toEqual({
      type: "ease",
      center: [10, 20],
      zoom: 14,
      padding: 50,
      duration: 0,
    });
  });

  it("fits a collection of two points", () => {
    const camera = drawnFeatureCamera(
      {
        type: "FeatureCollection",
        features: [
          point,
          {
            ...point,
            geometry: { type: "Point", coordinates: [12, 22] },
          },
        ],
      },
      { padding: 40 }
    );
    expect(camera.type).toBe("fit");
  });
});
