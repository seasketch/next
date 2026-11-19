import { APIRequestContext } from "@playwright/test";
import { createAccessProject, type AccessControl } from "./accessProject";
import { issueToken } from "./auth";
import { personas } from "./config";
import { graphql } from "./graphql";

export type ShellProject = { id: number; slug: string; name: string };

/**
 * A project this journey owns. Public projects are listed. The caller
 * hard-deletes the slug.
 */
export async function createShellProject(
  request: APIRequestContext,
  input: {
    name: string;
    slug: string;
    accessControl?: AccessControl;
    isListed?: boolean;
    about?: boolean;
    patch?: {
      hideSketches?: boolean;
      hideForums?: boolean;
      hideOverlays?: boolean;
      customDocLink?: string;
      showScalebarByDefault?: boolean;
      showLegendByDefault?: boolean;
    };
  }
): Promise<ShellProject> {
  const accessControl = input.accessControl ?? "PUBLIC";
  const isListed = input.isListed ?? accessControl === "PUBLIC";
  const project = await createAccessProject(request, {
    name: input.name,
    slug: input.slug,
    accessControl,
    isListed,
  });
  const admin = await issueToken(request, personas.admin);
  if (input.about) {
    await graphql(
      request,
      admin.accessToken,
      `mutation EnableAbout($slug: String!, $enabled: Boolean) {
        updateAboutPageEnabled(input: { slug: $slug, enabled: $enabled }) {
          project { id }
        }
      }`,
      { slug: project.slug, enabled: true }
    );
  }
  if (input.patch && Object.keys(input.patch).length > 0) {
    await graphql(
      request,
      admin.accessToken,
      `mutation PatchShell($slug: String!, $patch: ProjectPatch!) {
        updateProjectBySlug(input: { slug: $slug, patch: $patch }) {
          project { id }
        }
      }`,
      { slug: project.slug, patch: input.patch }
    );
  }
  return { ...project, name: input.name };
}

/** A published fill layer, so the legend has something to list. */
export async function addLegendLayer(
  request: APIRequestContext,
  projectId: number,
  title: string
) {
  const admin = await issueToken(request, personas.admin);
  const token = admin.accessToken;
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
    { projectId, url: `https://example.com/${title}.json` }
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
    `mutation AddLayer($projectId: Int!, $dataSourceId: Int!, $mapboxGlStyles: JSON) {
      createDataLayer(
        input: {
          dataLayer: {
            projectId: $projectId
            dataSourceId: $dataSourceId
            mapboxGlStyles: $mapboxGlStyles
          }
        }
      ) {
        dataLayer { id }
      }
    }`,
    {
      projectId,
      dataSourceId: sourceId,
      mapboxGlStyles: [{ type: "fill", paint: { "fill-color": "#2288cc" } }],
    }
  );
  const layerId = layer.createDataLayer.dataLayer?.id;
  if (layerId == null) {
    throw new Error(`createDataLayer returned no layer for ${title}`);
  }
  const stableId = `e2e${layerId.toString(36)}`.slice(0, 9);
  await graphql(
    request,
    token,
    `mutation AddItem(
      $projectId: Int!
      $title: String!
      $stableId: String!
      $dataLayerId: Int!
    ) {
      createTableOfContentsItem(
        input: {
          tableOfContentsItem: {
            projectId: $projectId
            title: $title
            stableId: $stableId
            isFolder: false
            dataLayerId: $dataLayerId
          }
        }
      ) {
        tableOfContentsItem { id }
      }
    }`,
    { projectId, title, stableId, dataLayerId: layerId }
  );
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
