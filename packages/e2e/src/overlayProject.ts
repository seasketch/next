import crypto from "crypto";
import { APIRequestContext } from "@playwright/test";
import { createAccessProject } from "./accessProject";
import { issueToken } from "./auth";
import { personas } from "./config";
import { graphql } from "./graphql";

/**
 * A public project this journey owns. Public projects have to be listed.
 * The journey hard-deletes it, so it does not stay on the directory.
 */
export async function createOverlayProject(
  request: APIRequestContext,
  name: string,
  slug: string
): Promise<{ id: number; slug: string; token: string }> {
  const project = await createAccessProject(request, {
    name,
    slug,
    accessControl: "PUBLIC",
    isListed: true,
  });
  const admin = await issueToken(request, personas.admin);
  return { ...project, token: admin.accessToken };
}

function stableId(): string {
  return crypto.randomBytes(6).toString("hex").slice(0, 9);
}

export async function addFolder(
  request: APIRequestContext,
  token: string,
  projectId: number,
  title: string,
  parentStableId?: string
): Promise<string> {
  const id = stableId();
  await graphql(
    request,
    token,
    `mutation AddFolder(
      $projectId: Int!
      $title: String!
      $stableId: String!
      $parentStableId: String
    ) {
      createTableOfContentsItem(
        input: {
          tableOfContentsItem: {
            projectId: $projectId
            title: $title
            stableId: $stableId
            isFolder: true
            parentStableId: $parentStableId
          }
        }
      ) {
        tableOfContentsItem { id }
      }
    }`,
    { projectId, title, stableId: id, parentStableId: parentStableId ?? null }
  );
  return id;
}

export async function addGeojsonLayer(
  request: APIRequestContext,
  token: string,
  projectId: number,
  title: string,
  parentStableId?: string
): Promise<string> {
  const id = stableId();
  const source = await graphql<{
    createDataSource: { dataSource: { id: number } | null };
  }>(
    request,
    token,
    `mutation AddSource($projectId: Int!, $url: String!) {
      createDataSource(
        input: {
          dataSource: { projectId: $projectId, type: GEOJSON, url: $url, attribution: "e2e" }
        }
      ) {
        dataSource { id }
      }
    }`,
    { projectId, url: `https://example.com/${id}.json` }
  );
  const sourceId = source.createDataSource.dataSource?.id;
  if (sourceId == null) {
    throw new Error(`createDataSource returned no source for ${title}`);
  }
  const layer = await graphql<{
    createDataLayer: { dataLayer: { id: number } | null };
  }>(
    request,
    token,
    `mutation AddLayer($projectId: Int!, $dataSourceId: Int!) {
      createDataLayer(
        input: {
          dataLayer: {
            projectId: $projectId
            dataSourceId: $dataSourceId
            mapboxGlStyles: []
          }
        }
      ) {
        dataLayer { id }
      }
    }`,
    { projectId, dataSourceId: sourceId }
  );
  const layerId = layer.createDataLayer.dataLayer?.id;
  if (layerId == null) {
    throw new Error(`createDataLayer returned no layer for ${title}`);
  }
  await graphql(
    request,
    token,
    `mutation AddItem(
      $projectId: Int!
      $title: String!
      $stableId: String!
      $dataLayerId: Int!
      $parentStableId: String
    ) {
      createTableOfContentsItem(
        input: {
          tableOfContentsItem: {
            projectId: $projectId
            title: $title
            stableId: $stableId
            isFolder: false
            dataLayerId: $dataLayerId
            parentStableId: $parentStableId
          }
        }
      ) {
        tableOfContentsItem { id }
      }
    }`,
    {
      projectId,
      title,
      stableId: id,
      dataLayerId: layerId,
      parentStableId: parentStableId ?? null,
    }
  );
  return id;
}

export async function publishAllOverlays(
  request: APIRequestContext,
  token: string,
  projectId: number
) {
  await graphql(
    request,
    token,
    `mutation Publish($projectId: Int!) {
      publishTableOfContents(input: { projectId: $projectId }) {
        clientMutationId
      }
    }`,
    { projectId }
  );
}
