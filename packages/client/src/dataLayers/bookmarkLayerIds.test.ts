import { missingBookmarkLayerIds } from "./bookmarkLayerIds";

const loaded = {
  loaded: true,
  stableIds: ["eez"],
  aliases: ["ref-eez", "42", "static-eez", "toc-row-1"],
};

describe("missingBookmarkLayerIds", () => {
  it("does not treat an unloaded catalog as missing layers", () => {
    expect(
      missingBookmarkLayerIds(["eez", "ref-eez"], {
        loaded: false,
        stableIds: [],
        aliases: [],
      })
    ).toEqual([]);
  });

  it("keeps stable ids and the ids older bookmarks stored", () => {
    expect(
      missingBookmarkLayerIds(
        ["eez", "ref-eez", "42", "static-eez", "toc-row-1"],
        loaded
      )
    ).toEqual([]);
  });

  it("reports an id that matches nothing in the project", () => {
    expect(missingBookmarkLayerIds(["eez", "gone", ""], loaded)).toEqual([
      "gone",
    ]);
  });

  it("returns nothing when the bookmark has no layers", () => {
    expect(missingBookmarkLayerIds([], loaded)).toEqual([]);
    expect(missingBookmarkLayerIds([""], loaded)).toEqual([]);
  });
});
