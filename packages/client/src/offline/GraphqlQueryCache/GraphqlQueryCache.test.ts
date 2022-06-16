/* eslint-disable i18next/no-literal-string */
import { DocumentNode, gql } from "@apollo/client";
import { OperationDefinitionNode } from "graphql";
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
import { Cache, CacheStorage, caches } from "cache-polyfill";
require("fake-indexeddb/auto");

global.caches = caches;

// @ts-ignore
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        data: { projectsBySlug: [{ id: 1, slug: "maldives" }] },
      }),
  })
);

const ENDPOINT = "https://example.com/graphql";
const ENDPOINT_URL = new URL(ENDPOINT);

function createMockRequest(json: any) {
  return {
    url: ENDPOINT,
    method: "POST",
    headers: {
      get: (key: string) => {
        if (key === "content-type") {
          return "application/json";
        } else {
          return "";
        }
      },
    },
    clone: () => createMockRequest(json),
    json: () => Promise.resolve(json),
  };
}

function createResponse(data: any) {
  return {
    url: ENDPOINT,
    headers: {
      get: (key: string) => undefined,
    },
    arrayBuffer: () => JSON.stringify(data),
    json: () => Promise.resolve(data),
    clone: () => createResponse(data),
  };
}

function createFetchRequestAndResponse(json: any, responseData: any) {
  // @ts-ignore
  fetch.mockImplementation((e: any) => {
    return Promise.resolve(createResponse(responseData));
  });
  return ({
    type: "fetch",
    request: createMockRequest(json),
  } as unknown) as FetchEvent;
}

async function mockGqlRequest(
  query: DocumentNode,
  variables: any,
  responseData: any
) {
  const operation = query.definitions.find(
    (d) => d.kind === "OperationDefinition"
  ) as OperationDefinitionNode;
  const operationName = operation.name?.value;
  const requestData = {
    operationName,
    variables,
    query: query.loc!.source.body.toString(),
  };
  await sleep(4);
  return createFetchRequestAndResponse(requestData, responseData);
}

beforeEach(async () => {
  // @ts-ignore
  fetch.mockClear();
  process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT = "true";
});

test("init", async () => {
  await localforage.clear();
  const cache = new GraphqlQueryCache(ENDPOINT, [
    staticStrategy(ProjectMetadataDocument),
  ]);
});

test("Disallow duplicate keys", async () => {
  await localforage.clear();
  expect(() => {
    const cache = new GraphqlQueryCache(ENDPOINT, [
      byArgsStrategy(ProjectMetadataDocument, "selected-projects"),
      byArgsStrategy(SurveyDocument, "selected-projects"),
    ]);
  }).toThrow(/strategy/);
});

test("Disallows multiple strategies of the same type and query", async () => {
  await localforage.clear();
  expect(() => {
    const cache = new GraphqlQueryCache(ENDPOINT, [
      lruStrategy(ProjectMetadataDocument, 50),
      lruStrategy(ProjectMetadataDocument, 10),
    ]);
  }).toThrow(/strategy/);
});

test("Can be enabled and disabled by env setting", async () => {
  await localforage.clear();
  process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT = "false";
  const cache = new GraphqlQueryCache(ENDPOINT, [
    staticStrategy(ProjectMetadataDocument),
  ]);
  expect(await cache.isEnabled()).toBe(false);
  await localforage.clear();
  process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT = "true";
  const cache2 = new GraphqlQueryCache(ENDPOINT, [
    staticStrategy(ProjectMetadataDocument),
  ]);
  expect(await cache2.isEnabled()).toBe(true);
});

const ProjectBySlug = gql`
  query ProjectBySlug($slug: String!) {
    projectBySlug(slug: $slug) {
      id
      name
    }
  }
`;

test("Requests not matching a strategy are passed through to fetch", async () => {
  process.env.REACT_APP_ENABLE_GRAPHQL_QUERY_CACHE_BY_DEFAULT = "true";
  const cache = new GraphqlQueryCache(ENDPOINT, [
    staticStrategy(ProjectMetadataDocument),
  ]);
  const request = await mockGqlRequest(
    ProjectBySlug,
    { slug: "maldives" },
    {
      data: {
        projectBySlug: { id: 1, name: "Maldives" },
      },
    }
  );
  const response = await cache.handleRequest(ENDPOINT_URL, request);
  const json = await response.json();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(json.data.projectBySlug.id).toBe(1);
});

describe("Static strategy", () => {
  test("Returns cached results for subsequent requests", async () => {
    const cache = new GraphqlQueryCache(ENDPOINT, [
      staticStrategy(ProjectBySlug),
    ]);
    await cache.clear();
    const request = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          projectBySlug: { id: 1, name: "Maldives" },
        },
      }
    );
    const response = await cache.handleRequest(ENDPOINT_URL, request);
    const json = await response.json();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(json.data.projectBySlug.id).toBe(1);

    const secondRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          // This data has changed but we should be accessing the cache in the
          // second request
          projectBySlug: { id: 1, name: "Maldives - Updated" },
        },
      }
    );
    const response2 = await cache.handleRequest(ENDPOINT_URL, secondRequest);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await response2.json()).data.projectBySlug.name).toBe("Maldives");
    await cache.clear();
  });

  test("New requests with different variables replace cache", async () => {
    const cache = new GraphqlQueryCache(ENDPOINT, [
      staticStrategy(ProjectBySlug),
    ]);
    await cache.clear();
    const request = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          projectBySlug: { id: 1, name: "Maldives" },
        },
      }
    );
    const response = await cache.handleRequest(ENDPOINT_URL, request);
    const json = await response.json();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(json.data.projectBySlug.id).toBe(1);

    const secondRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 2, name: "Azores" },
        },
      }
    );
    const response2 = await cache.handleRequest(ENDPOINT_URL, secondRequest);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await response2.json()).data.projectBySlug.name).toBe("Azores");
    const thirdRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 2, name: "Azores" },
        },
      }
    );
    const response3 = await cache.handleRequest(ENDPOINT_URL, thirdRequest);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await response3.json()).data.projectBySlug.name).toBe("Azores");
    await cache.clear();
  });
});

describe("lru strategy", () => {
  test("Limits size of cache to most recently used", async () => {
    // push order
    // maldives
    // azores
    // fiji
    // azores again
    // maldives again
    // azores again

    const cache = new GraphqlQueryCache(ENDPOINT, [
      lruStrategy(ProjectBySlug, 2),
    ]);
    await cache.clear();
    cache.cachePruningDebounceInterval = 5;
    const maldivesRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          projectBySlug: { id: 1, name: "Maldives" },
        },
      }
    );
    const response = await cache.handleRequest(ENDPOINT_URL, maldivesRequest);
    const json = await response.json();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(json.data.projectBySlug.name).toBe("Maldives");
    const azoresRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 2, name: "Azores" },
        },
      }
    );
    await cache.handleRequest(ENDPOINT_URL, azoresRequest);
    const fijiRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "fiji" },
      {
        data: {
          projectBySlug: { id: 3, name: "Fiji" },
        },
      }
    );
    await cache.handleRequest(ENDPOINT_URL, fijiRequest);
    expect(fetch).toHaveBeenCalledTimes(3);

    // Azores should still be in cache
    const azoresRequest2 = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 2, name: "Azores" },
        },
      }
    );
    await cache.handleRequest(ENDPOINT_URL, azoresRequest2);
    expect(fetch).toHaveBeenCalledTimes(3);

    // Maldives should not, and trigger another request
    const maldivesRequest2 = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          projectBySlug: { id: 1, name: "Maldives (Edited)" },
        },
      }
    );
    const maldivesEdited = await cache.handleRequest(
      ENDPOINT_URL,
      maldivesRequest2
    );
    expect(fetch).toHaveBeenCalledTimes(4);
    expect((await maldivesEdited.json()).data.projectBySlug.name).toBe(
      "Maldives (Edited)"
    );

    // azores should still be cached
    const azoresRequest3 = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 3, name: "Azores (Edited)" },
        },
      }
    );
    const azoresCached = await cache.handleRequest(
      ENDPOINT_URL,
      azoresRequest3
    );
    expect(fetch).toHaveBeenCalledTimes(4);
    expect((await azoresCached.json()).data.projectBySlug.name).toBe("Azores");
    await cache.clear();
  });
});

describe("byArgs strategy", () => {
  test("Caches queries with specific arguments and ignores others", async () => {
    const cache = new GraphqlQueryCache(ENDPOINT, [
      byArgsStrategy(ProjectBySlug, "selected-projects"),
    ]);
    await cache.clear();
    cache.cachePruningDebounceInterval = 5;
    cache.setStrategyArgs("selected-projects", [{ slug: "maldives" }]);
    const maldivesRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          projectBySlug: { id: 1, name: "Maldives" },
        },
      }
    );
    const response = await cache.handleRequest(ENDPOINT_URL, maldivesRequest);
    const json = await response.json();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(json.data.projectBySlug.name).toBe("Maldives");

    const secondMaldivesRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "maldives" },
      {
        data: {
          projectBySlug: { id: 1, name: "Maldives (Updated)" },
        },
      }
    );
    const response2 = await cache.handleRequest(
      ENDPOINT_URL,
      secondMaldivesRequest
    );
    const json2 = await response2.json();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(json2.data.projectBySlug.name).toBe("Maldives");

    // The following are ignored by the strategy
    const azoresRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 1, name: "azores" },
        },
      }
    );
    const response3 = await cache.handleRequest(ENDPOINT_URL, azoresRequest);
    const json3 = await response3.json();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(json3.data.projectBySlug.name).toBe("azores");

    const secondazoresRequest = await mockGqlRequest(
      ProjectBySlug,
      { slug: "azores" },
      {
        data: {
          projectBySlug: { id: 1, name: "azores (updated)" },
        },
      }
    );
    const response4 = await cache.handleRequest(
      ENDPOINT_URL,
      secondazoresRequest
    );
    const json4 = await response4.json();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(json4.data.projectBySlug.name).toBe("azores (updated)");
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
