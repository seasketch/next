/// <reference types="jest" />
import { PoolClient } from "pg";
import { createPgPool } from "./pool";
import {
  isInvalidRemoteError,
  sharedLibraryRemotes,
} from "../tasks/cleanupDeletedOverlayRecords";

const pool = createPgPool("test");

afterAll(async () => {
  await pool.end();
});

async function inRolledBackTransaction(fn: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await fn(client);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

async function insertSourceWithOutput(
  client: PoolClient,
  projectId: number,
  remote: string
) {
  const {
    rows: [source],
  } = await client.query<{ id: number }>(
    `insert into data_sources (project_id, type, import_type, url) values ($1, 'seasketch-mvt', 'upload', 'https://tiles.example.test/x') returning id`,
    [projectId]
  );
  await client.query(
    `insert into data_upload_outputs (data_source_id, project_id, type, url, remote, filename, size, is_original) values ($1, $2, 'FlatGeobuf', 'https://uploads.example.test/x.fgb', $3, 'x.fgb', 1, true)`,
    [source.id, projectId, remote]
  );
  return source.id;
}

async function superuserProjectId(client: PoolClient) {
  const { rows } = await client.query<{ id: number }>(
    `select id from projects where slug = 'superuser'`
  );
  return rows[0].id;
}

async function otherProjectId(client: PoolClient) {
  const { rows } = await client.query<{ id: number }>(
    `insert into projects (name, slug, support_email, creator_id) values ('Cleanup guard', 'cleanup-guard-' || floor(random() * 1e9)::text, 'test@example.test', (select id from users where sub = 'seasketch|root')) returning id`
  );
  return rows[0].id;
}

describe("isInvalidRemoteError", () => {
  test("discards a remote storage rejected as an illegal bucket or missing object", () => {
    expect(
      isInvalidRemoteError({
        code: "InvalidBucketName",
        statusCode: 400,
        retryable: false,
        message: "The specified bucket name is not valid.",
      })
    ).toBe(true);
    expect(
      isInvalidRemoteError({ code: "NoSuchBucket", statusCode: 404 })
    ).toBe(true);
    expect(isInvalidRemoteError({ code: "NoSuchKey", statusCode: 404 })).toBe(
      true
    );
    expect(isInvalidRemoteError({ code: "InvalidURI", statusCode: 400 })).toBe(
      true
    );
    expect(
      isInvalidRemoteError({ code: "KeyTooLongError", statusCode: 400 })
    ).toBe(true);
  });

  test("keeps the record when storage or the network may recover", () => {
    expect(
      isInvalidRemoteError({
        code: "InternalError",
        statusCode: 500,
        retryable: true,
      })
    ).toBe(false);
    expect(
      isInvalidRemoteError({
        code: "ServiceUnavailable",
        statusCode: 503,
        retryable: true,
      })
    ).toBe(false);
    expect(
      isInvalidRemoteError({ code: "SlowDown", statusCode: 503, retryable: true })
    ).toBe(false);
    expect(
      isInvalidRemoteError({ code: "NetworkingError", retryable: true })
    ).toBe(false);
    expect(
      isInvalidRemoteError({
        code: "RequestTimeout",
        statusCode: 400,
        retryable: true,
      })
    ).toBe(false);
    expect(isInvalidRemoteError({ statusCode: 502, retryable: true })).toBe(
      false
    );
  });

  test("keeps the record for auth and other unrecognized failures", () => {
    expect(
      isInvalidRemoteError({
        code: "AccessDenied",
        statusCode: 403,
        retryable: false,
      })
    ).toBe(false);
    expect(
      isInvalidRemoteError({
        code: "SignatureDoesNotMatch",
        statusCode: 403,
        retryable: false,
      })
    ).toBe(false);
    expect(
      isInvalidRemoteError({
        code: "InvalidAccessKeyId",
        statusCode: 403,
        retryable: false,
      })
    ).toBe(false);
    expect(isInvalidRemoteError(new Error("socket hang up"))).toBe(false);
    expect(isInvalidRemoteError(null)).toBe(false);
  });
});

describe("sharedLibraryRemotes outside production", () => {
  test("keeps superuser outputs, including after their data source is deleted", async () => {
    await inRolledBackTransaction(async (client) => {
      const pid = await superuserProjectId(client);
      const live = "r2://ssn-tiles/projects/superuser/public/live.fgb";
      const orphaned = "r2://ssn-tiles/projects/superuser/public/orphaned.fgb";
      await insertSourceWithOutput(client, pid, live);
      const orphanedSource = await insertSourceWithOutput(client, pid, orphaned);
      await client.query(`delete from data_sources where id = $1`, [
        orphanedSource,
      ]);
      const { rows } = await client.query(
        `select 1 from deleted_data_upload_outputs where remote = $1`,
        [orphaned]
      );
      expect(rows.length).toBe(1);

      const remotes = await sharedLibraryRemotes(client);
      expect(remotes.has(live)).toBe(true);
      expect(remotes.has(orphaned)).toBe(true);
    });
  });

  test("does not keep deleted outputs from other projects", async () => {
    await inRolledBackTransaction(async (client) => {
      const pid = await otherProjectId(client);
      const remote = "r2://ssn-tiles/projects/other/public/gone.fgb";
      const sourceId = await insertSourceWithOutput(client, pid, remote);
      await client.query(`delete from data_sources where id = $1`, [sourceId]);

      const remotes = await sharedLibraryRemotes(client);
      expect(remotes.has(remote)).toBe(false);
    });
  });

  test("protects nothing in production", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await inRolledBackTransaction(async (client) => {
        const pid = await superuserProjectId(client);
        await insertSourceWithOutput(
          client,
          pid,
          "r2://ssn-tiles/projects/superuser/public/prod.fgb"
        );
        const remotes = await sharedLibraryRemotes(client);
        expect(remotes.size).toBe(0);
      });
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
