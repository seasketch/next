import { sql } from "slonik";
import { createPool } from "./pool";
import {
  createUser,
  createProject,
  addParticipant,
  createSession,
  clearSession,
  createGroup,
  addGroupToAcl,
  projectTransaction,
  verifyOnlyAuthorsCanEditRecords,
  verifyOnlyAuthorsCanAccessRecords,
  verifyOnlyProjectGroupMembersCanAccessResource,
  limitToGroup,
  verifyCRUDOpsLimitedToAdmins,
} from "./helpers";

const pool = createPool("test");

describe("Basemaps", () => {
  test("Basemaps can only be created by project admins", async () => {
    await verifyCRUDOpsLimitedToAdmins(pool, {
      create: async (conn, projectId, adminId) => {
        return sql`insert into basemaps (project_id, name, type, url, thumbnail) values (${projectId}, 'basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`;
      },
      update: (id) => {
        return sql`update basemaps set name = 'satellite' where id = ${id} returning *`;
      },
      delete: (id) => {
        return sql`delete from basemaps where id = ${id}`;
      },
    });
  });
  test("Basemap access is controlled by an access control list", async () => {
    await verifyOnlyProjectGroupMembersCanAccessResource(
      pool,
      "basemaps",
      async (conn, projectId, groupId, adminId) => {
        await createSession(conn, adminId, true, false, projectId);
        const basemapId = await conn.oneFirst(
          sql`insert into basemaps (project_id, name, type, url, thumbnail) values (${projectId}, 'basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
        );
        await limitToGroup(conn, "basemap_id", basemapId, groupId);
        return basemapId as number;
      }
    );
  });

  describe("Shared Basemaps", () => {
    test("Shared Basemaps can only be created by superusers", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, true, projectId);
          const basemapId = await conn.oneFirst(
            sql`insert into basemaps (name, type, url, thumbnail) values ('shared basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          expect(basemapId).toBeTruthy();
        }
      );
    });
    test("Shared Basemaps can be enabled for projects, giving their users access", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, true, projectId);
          const sharedBasemapId = await conn.oneFirst(
            sql`insert into basemaps (name, type, url, thumbnail) values ('shared basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          await createSession(conn, adminId, true, false, projectId);
          const record = await conn.one(
            sql`insert into projects_shared_basemaps (basemap_id, project_id) values (${sharedBasemapId}, ${projectId}) returning *`
          );
          expect(record.project_id).toBe(projectId);
          const basemaps = await conn.any(
            sql`select projects_basemaps(projects.*) from projects where id = ${projectId}`
          );
          expect(basemaps.length).toBe(3);
        }
      );
    });
    test("Only admins can enable Shared Basemaps for their projects", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, true, projectId);
          const sharedBasemapId = await conn.oneFirst(
            sql`insert into basemaps (name, type, url, thumbnail) values ('shared basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          await createSession(conn, user1, true, false, projectId);
          expect(
            conn.one(
              sql`insert into projects_shared_basemaps (basemap_id, project_id) values (${sharedBasemapId}, ${projectId}) returning *`
            )
          ).rejects.toThrow(/security/);
        }
      );
    });
    test("Shared basemaps are visible to all users", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, true, projectId);
          const sharedBasemapId = await conn.oneFirst(
            sql`insert into basemaps (name, type, url, thumbnail) values ('shared basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          await createSession(conn);
          const basemaps = await conn.any(sql`select * from basemaps`);
          expect(basemaps.length).toBe(3);
        }
      );
    });
    test("Both project-basemaps and shared basemaps are accessible via the projects_basemaps() relation", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, true, projectId);
          const sharedBasemapId = await conn.oneFirst(
            sql`insert into basemaps (name, type, url, thumbnail) values ('shared basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          const sharedBasemapId2NotAdded = await conn.oneFirst(
            sql`insert into basemaps (name, type, url, thumbnail) values ('shared basemap b', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          await createSession(conn, adminId, true, false, projectId);
          const record = await conn.one(
            sql`insert into projects_shared_basemaps (basemap_id, project_id) values (${sharedBasemapId}, ${projectId}) returning *`
          );
          expect(record.project_id).toBe(projectId);
          await conn.oneFirst(
            sql`insert into basemaps (project_id, name, type, url, thumbnail) values (${projectId}, 'project basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          const basemaps = await conn.any(
            sql`select projects_basemaps(projects.*) from projects where id = ${projectId}`
          );
          expect(basemaps.length).toBe(4);
        }
      );
    });
  });

  describe("Basemap Optional Layers", () => {
    test("Components can be identified to toggle within a basemap", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, false, projectId);
          const basemapId = await conn.oneFirst(
            sql`insert into basemaps (project_id, name, type, url, thumbnail) values (${projectId}, 'project basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id`
          );
          const optionalBasemapLayerId = await conn.oneFirst(
            sql`insert into optional_basemap_layers (basemap_id, layers, name) values (${basemapId}, ${sql.array(
              ["layer1"],
              "text"
            )}, 'optional layer a') returning id`
          );
          expect(optionalBasemapLayerId).toBeTruthy();
          await createSession(conn, user1, true, false, projectId);
          const optionalLayers = await conn.any(
            sql`select * from optional_basemap_layers where basemap_id = ${basemapId}`
          );
          expect(optionalLayers.length).toBe(1);
        }
      );
    });
  });

  describe("Interactivity settings", () => {
    test("Admins (and only admins) can set interactivity settings on project basemaps", async () => {
      await projectTransaction(
        pool,
        "public",
        async (conn, projectId, adminId, [user1, user2]) => {
          await createSession(conn, adminId, true, false, projectId);
          const basemap = await conn.one(
            sql`insert into basemaps (project_id, name, type, url, thumbnail) values (${projectId}, 'project basemap a', 'MAPBOX', 'mapbox://my-map/id', 'https://thumbnail.org/1.png') returning id, interactivity_settings_id`
          );
          expect(basemap.interactivity_settings_id).toBeTruthy();
          const newType = await conn.oneFirst(
            sql`update interactivity_settings set type = 'BANNER' where id = ${basemap.interactivity_settings_id} returning type`
          );
          expect(newType).toBe("BANNER");

          await createSession(conn, user1, true, false, projectId);
          const interactivitySettings = await conn.any(
            sql`select * from interactivity_settings where id = ${basemap.interactivity_settings_id}`
          );
          expect(interactivitySettings.length).toBe(1);
        }
      );
    });
  });
});
