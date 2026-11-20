import { describe, expect, it } from "@jest/globals";
import { mapBookmarkPath, mapViewOmissions } from "./mapViewBookmark";

describe("mapViewOmissions", () => {
  it("says nothing when the map has no sketches or drawings", () => {
    expect(
      mapViewOmissions({ sketches: [], unsavedDrawing: false })
    ).toEqual({
      sketches: false,
      unsharedSketches: false,
      unsavedDrawing: false,
    });
  });

  it("notes sketches that are already shared", () => {
    expect(
      mapViewOmissions({
        sketches: [{ sharedInForum: true }],
        unsavedDrawing: false,
      })
    ).toEqual({
      sketches: true,
      unsharedSketches: false,
      unsavedDrawing: false,
    });
  });

  it("notes unshared sketches separately from shared ones", () => {
    expect(
      mapViewOmissions({
        sketches: [{ sharedInForum: true }, { sharedInForum: false }],
        unsavedDrawing: false,
      }).unsharedSketches
    ).toBe(true);
  });

  it("notes unsaved drawing markup when no sketch is on the map", () => {
    expect(
      mapViewOmissions({ sketches: [], unsavedDrawing: true })
    ).toEqual({
      sketches: false,
      unsharedSketches: false,
      unsavedDrawing: true,
    });
  });
});

describe("mapBookmarkPath", () => {
  it("points at the project bookmark route", () => {
    expect(mapBookmarkPath("demo-samoa", "abc")).toBe(
      "/demo-samoa/bookmarks/abc"
    );
  });
});
