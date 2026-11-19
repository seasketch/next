import {
  bookmarkCamera,
  bookmarkDimensions,
  bookmarkName,
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
