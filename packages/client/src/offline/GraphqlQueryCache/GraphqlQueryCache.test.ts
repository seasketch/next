import localforage from "localforage";
import {
  byArgsStrategy,
  GraphqlQueryCache,
  lruStrategy,
  staticStrategy,
} from ".";
import { SurveyDocument } from "../../generated/graphql";
import { ProjectMetadataDocument } from "../../generated/queries";

// @ts-ignore
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ rates: { CAD: 1.42 } }),
  })
);

test("init", async () => {
  await localforage.clear();
  const cache = new GraphqlQueryCache("https://example.com/graphql", [
    staticStrategy(ProjectMetadataDocument),
  ]);
});

test("Disallow duplicate kes", async () => {
  await localforage.clear();
  expect(() => {
    const cache = new GraphqlQueryCache("https://example.com/graphql", [
      byArgsStrategy(ProjectMetadataDocument, "selected-projects"),
      byArgsStrategy(SurveyDocument, "selected-projects"),
    ]);
  }).toThrow(/strategy/);
});

test("Disallows multiple strategies of the same type and query", async () => {
  await localforage.clear();
  expect(() => {
    const cache = new GraphqlQueryCache("https://example.com/graphql", [
      lruStrategy(ProjectMetadataDocument, 50),
      lruStrategy(ProjectMetadataDocument, 10),
    ]);
  }).toThrow(/strategy/);
});

test("Can be enabled and disabled by env setting", async () => {
  await localforage.clear();
  process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT = "false";
  const cache = new GraphqlQueryCache("https://example.com/graphql", [
    staticStrategy(ProjectMetadataDocument),
  ]);
  expect(await cache.isEnabled()).toBe(false);
  await localforage.clear();
  process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT = "true";
  const cache2 = new GraphqlQueryCache("https://example.com/graphql", [
    staticStrategy(ProjectMetadataDocument),
  ]);
  expect(await cache2.isEnabled()).toBe(true);
});
