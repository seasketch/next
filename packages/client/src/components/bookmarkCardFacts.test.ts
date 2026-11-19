import {
  bookmarkCamera,
  bookmarkDimensions,
  bookmarkName,
  fitImageSize,
} from "./bookmarkCardFacts";

describe("bookmarkCamera", () => {
  it("rejects null, undefined, and non-objects", () => {
    expect(bookmarkCamera(null)).toBeNull();
    expect(bookmarkCamera(undefined)).toBeNull();
    expect(bookmarkCamera("zoom")).toBeNull();
    expect(bookmarkCamera([])).toBeNull();
  });

  it("reads a zoom and a center", () => {
    expect(bookmarkCamera({ zoom: 8.2, center: [171.2, -13.8] })).toEqual({
      zoom: 8.2,
      center: [171.2, -13.8],
    });
  });

  it("rejects a center that is not a pair of numbers", () => {
    expect(bookmarkCamera({ zoom: 4, center: ["a", 1] })).toBeNull();
  });
});

describe("bookmarkName", () => {
  it("rejects null and missing keys", () => {
    expect(bookmarkName(null, "land")).toBeNull();
    expect(bookmarkName(undefined, "land")).toBeNull();
    expect(bookmarkName({ other: "Land" }, "land")).toBeNull();
  });

  it("reads a string name", () => {
    expect(bookmarkName({ land: "Land" }, "land")).toBe("Land");
  });
});

describe("fitImageSize", () => {
  it("keeps an image that already fits", () => {
    expect(
      fitImageSize({ width: 800, height: 500 }, { width: 1400, height: 900 })
    ).toEqual({ width: 800, height: 500 });
  });

  it("scales down to the window edge that is reached first", () => {
    expect(
      fitImageSize({ width: 2000, height: 1000 }, { width: 1000, height: 900 })
    ).toEqual({ width: 1000, height: 500 });
    expect(
      fitImageSize({ width: 1000, height: 2000 }, { width: 900, height: 800 })
    ).toEqual({ width: 400, height: 800 });
  });

  it("rejects empty sizes", () => {
    expect(fitImageSize({ width: 0, height: 100 }, { width: 10, height: 10 })).toBeNull();
  });
});

describe("bookmarkDimensions", () => {
  it("rejects null, undefined, and incomplete lists", () => {
    expect(bookmarkDimensions(null)).toBeNull();
    expect(bookmarkDimensions(undefined)).toBeNull();
    expect(bookmarkDimensions([1200])).toBeNull();
    expect(bookmarkDimensions(["1200", 800])).toBeNull();
  });

  it("reads a width and a height", () => {
    expect(bookmarkDimensions([1200, 800])).toEqual([1200, 800]);
  });
});
