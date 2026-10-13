import { positionsInGeojson } from "./distancePathBounds";
import { searchArea, simplifiedRingLength } from "./searchArea";

function bbox(value: unknown): [number, number, number, number] | null {
  const positions = positionsInGeojson(value);
  if (positions.length === 0) return null;
  let west = positions[0][0];
  let east = west;
  let south = positions[0][1];
  let north = south;
  for (const [lng, lat] of positions) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

describe("searchArea", () => {
  it("returns nothing for empty or non-positive input", () => {
    expect(searchArea(null, 100)).toBeNull();
    expect(searchArea(undefined, 100)).toBeNull();
    expect(
      searchArea(
        { type: "Point", coordinates: [0, 0] },
        0
      )
    ).toBeNull();
    expect(
      searchArea(
        { type: "Point", coordinates: [0, 0] },
        -10
      )
    ).toBeNull();
  });

  it("grows a point by about one degree of latitude per 110.574 km", () => {
    const area = searchArea({ type: "Point", coordinates: [0, 0] }, 110.574);
    const box = bbox(area);
    expect(box).not.toBeNull();
    expect(box![0]).toBeCloseTo(-1, 1);
    expect(box![1]).toBeCloseTo(-1, 1);
    expect(box![2]).toBeCloseTo(1, 1);
    expect(box![3]).toBeCloseTo(1, 1);
  });

  it("buffers a square outward on every side", () => {
    const area = searchArea(
      {
        type: "Polygon",
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
      110.574
    );
    const box = bbox(area);
    expect(box).not.toBeNull();
    expect(box![0]).toBeLessThan(-0.8);
    expect(box![1]).toBeLessThan(-0.8);
    expect(box![2]).toBeGreaterThan(1.8);
    expect(box![3]).toBeGreaterThan(1.8);
  });

  it("keeps a sketch stored past 180 degrees on a compact outline", () => {
    const area = searchArea(
      {
        type: "Polygon",
        coordinates: [
          [
            [185.7, -11.02],
            [185.77, -11.02],
            [185.77, -10.96],
            [185.7, -10.96],
            [185.7, -11.02],
          ],
        ],
      },
      110.574
    );
    const box = bbox(area);
    expect(box).not.toBeNull();
    expect(box![0]).toBeGreaterThan(-178);
    expect(box![2]).toBeLessThan(-170);
    expect(box![2] - box![0]).toBeLessThan(4);
    expect(box![3] - box![1]).toBeLessThan(4);
  });

  it("keeps a concave corner from spiking past twice the radius", () => {
    const area = searchArea(
      {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 2],
            [0, 2],
            [0, 0],
          ],
        ],
      },
      110.574
    );
    const box = bbox(area);
    expect(box).not.toBeNull();
    expect(box![0]).toBeGreaterThan(-2.2);
    expect(box![1]).toBeGreaterThan(-2.2);
    expect(box![2]).toBeLessThan(4.2);
    expect(box![3]).toBeLessThan(4.2);
    expect(box![0]).toBeLessThan(-0.5);
    expect(box![2]).toBeGreaterThan(2.5);
  });

  it("drops most vertices from a dense ring before buffering", () => {
    const ring: Array<[number, number]> = [];
    for (let i = 0; i <= 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      ring.push([Math.cos(angle) * 0.5, Math.sin(angle) * 0.5]);
    }
    expect(simplifiedRingLength(ring, 300, 1)).toBeLessThan(20);
  });
});
