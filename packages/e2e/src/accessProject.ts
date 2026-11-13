import { APIRequestContext } from "@playwright/test";
import { issueToken } from "./auth";
import { personas } from "./config";
import { graphql } from "./graphql";

export type AccessControl = "ADMINS_ONLY" | "INVITE_ONLY" | "PUBLIC";

/**
 * A project this journey owns. create_project starts it unlisted and
 * admins-only; the patch is the access setting the journey is about.
 */
export async function createAccessProject(
  request: APIRequestContext,
  input: {
    name: string;
    slug: string;
    accessControl: AccessControl;
    isListed: boolean;
  }
): Promise<{ id: number; slug: string }> {
  const admin = await issueToken(request, personas.admin);
  const created = await graphql<{
    createProject: { project: { id: number; slug: string } | null };
  }>(
    request,
    admin.accessToken,
    `mutation CreateProject($name: String!, $slug: String!) {
      createProject(input: { name: $name, slug: $slug }) {
        project { id slug }
      }
    }`,
    { name: input.name, slug: input.slug }
  );
  const project = created.createProject.project;
  if (!project) {
    throw new Error(`createProject returned no project for ${input.slug}`);
  }
  await graphql(
    request,
    admin.accessToken,
    `mutation UpdateAccess(
      $slug: String!
      $accessControl: ProjectAccessControlSetting!
      $isListed: Boolean!
    ) {
      updateProjectBySlug(
        input: {
          slug: $slug
          patch: { accessControl: $accessControl, isListed: $isListed }
        }
      ) {
        project { id }
      }
    }`,
    {
      slug: project.slug,
      accessControl: input.accessControl,
      isListed: input.isListed,
    }
  );
  return project;
}

export async function currentUserId(
  request: APIRequestContext,
  token: string
): Promise<number> {
  const data = await graphql<{ me: { id: number } | null }>(
    request,
    token,
    `query Me { me { id } }`
  );
  if (!data.me) {
    throw new Error("me returned no user");
  }
  return data.me.id;
}

export async function inviteMember(
  request: APIRequestContext,
  projectId: number,
  email: string,
  fullname: string,
  makeAdmin = false,
  groupNames: string[] = []
) {
  const admin = await issueToken(request, personas.admin);
  await graphql(
    request,
    admin.accessToken,
    `mutation Invite(
      $projectId: Int!
      $email: Email
      $fullname: String
      $makeAdmin: Boolean
      $groupNames: [String]
    ) {
      createProjectInvites(
        input: {
          projectId: $projectId
          makeAdmin: $makeAdmin
          groupNames: $groupNames
          sendEmailNow: true
          projectInviteOptions: [{ email: $email, fullname: $fullname }]
        }
      ) {
        projectInvites { id email }
      }
    }`,
    { projectId, email, fullname, makeAdmin, groupNames }
  );
}

export async function approveMember(
  request: APIRequestContext,
  projectId: number,
  userId: number
) {
  const admin = await issueToken(request, personas.admin);
  await graphql(
    request,
    admin.accessToken,
    `mutation Approve($projectId: Int!, $userId: Int!) {
      approveParticipant(input: { projectId: $projectId, userId: $userId }) {
        user { id }
      }
    }`,
    { projectId, userId }
  );
}

export async function denyMember(
  request: APIRequestContext,
  projectId: number,
  userId: number
) {
  const admin = await issueToken(request, personas.admin);
  await graphql(
    request,
    admin.accessToken,
    `mutation Deny($projectId: Int!, $userId: Int!) {
      denyParticipant(input: { projectId: $projectId, userId: $userId }) {
        user { id }
      }
    }`,
    { projectId, userId }
  );
}

/** Users still waiting on Access Requests. Approval false keeps a denied row here. */
export async function accessRequestIds(
  request: APIRequestContext,
  slug: string
): Promise<number[]> {
  const admin = await issueToken(request, personas.admin);
  const data = await graphql<{
    projectBySlug: { accessRequestsConnection: { nodes: { id: number }[] } } | null;
  }>(
    request,
    admin.accessToken,
    `query ($slug: String!) {
      projectBySlug(slug: $slug) {
        accessRequestsConnection { nodes { id } }
      }
    }`,
    { slug }
  );
  return data.projectBySlug?.accessRequestsConnection.nodes.map((node) => node.id) ?? [];
}
