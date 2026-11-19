/* eslint-disable i18next/no-literal-string */
import { buildEncStyle, encArchiveSources } from "./buildEncStyle";

describe("encArchiveSources", () => {
  test("returns nothing for missing or malformed settings", () => {
    expect(encArchiveSources(null)).toEqual([]);
    expect(encArchiveSources(undefined)).toEqual([]);
    expect(encArchiveSources("sources")).toEqual([]);
    expect(encArchiveSources({})).toEqual([]);
    expect(encArchiveSources({ sources: "small" })).toEqual([]);
  });

  test("skips entries without a usable id or url", () => {
    expect(
      encArchiveSources({
        sources: [
          null,
          7,
          { id: "small" },
          { url: "https://tiles/a" },
          { id: "bad id!", url: "https://tiles/a" },
          { id: "coastal", url: "" },
        ],
      })
    ).toEqual([]);
  });

  test("reads valid archives in order", () => {
    expect(
      encArchiveSources({
        sources: [
          { id: "small", url: "https://tiles/a", maxzoom: 10 },
          { id: "harbour", url: "https://tiles/b", maxzoom: "16" },
        ],
      })
    ).toEqual([
      { id: "small", url: "https://tiles/a", maxzoom: 10 },
      { id: "harbour", url: "https://tiles/b", maxzoom: undefined },
    ]);
  });
});

describe("buildEncStyle", () => {
  const tileJson = (url: string) => `proxied:${url}`;

  test("uses one source for charts without archive settings", () => {
    const style = buildEncStyle(
      { url: "https://tiles/one", encBasemap: { settings: {} } },
      tileJson
    );
    expect(Object.keys(style.sources)).toEqual(["s57"]);
    expect(style.sources.s57).toMatchObject({
      url: "proxied:https://tiles/one.json",
    });
  });

  test("adds a source per archive for charts split by scale", () => {
    const style = buildEncStyle(
      {
        url: "https://tiles/b",
        encBasemap: {
          settings: {
            sources: [
              { id: "small", url: "https://tiles/a", maxzoom: 10 },
              { id: "harbour", url: "https://tiles/b.json", maxzoom: 16 },
            ],
          },
        },
      },
      tileJson
    );
    expect(Object.keys(style.sources)).toEqual(["s57-small", "s57-harbour"]);
    expect(style.sources["s57-small"]).toMatchObject({
      url: "proxied:https://tiles/a.json",
    });
    expect(style.sources["s57-harbour"]).toMatchObject({
      url: "proxied:https://tiles/b.json",
    });
  });
});
