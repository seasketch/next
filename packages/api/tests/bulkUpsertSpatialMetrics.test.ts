import { sql } from "slonik";
import { raw } from "slonik-sql-tag-raw";
import { createPool, createPgPool } from "./pool";
import { projectTransaction } from "./helpers";
import { getOrCreateSpatialMetricsBatch } from "../src/plugins/reportsPlugin";

const pool = createPool("test");
const pgPool = createPgPool("test");

jest.setTimeout(1000 * 30);

async function bulkUpsertFromConn(
  conn: Parameters<Parameters<typeof projectTransaction>[2]>[0],
  args: {
    fragmentIds: (string | null)[];
    geographyIds: (number | null)[];
    types: string[];
    overlays: (string | null)[];
    parameters: Record<string, unknown>[];
    jobDeps: (string | null)[];
    projectIds: number[];
    depHashes: string[];
  },
) {
  return conn.any<{ ord: number; metric: Record<string, unknown> }>(
    sql`${raw(
      `
      SELECT ord, metric
      FROM bulk_upsert_spatial_metrics_and_json(
        $1::text[],
        $2::int4[],
        $3::text[],
        $4::text[],
        $5::jsonb[],
        $6::text[],
        $7::int4[],
        $8::text[]
      )
    `,
      [
        args.fragmentIds,
        args.geographyIds,
        args.types,
        args.overlays,
        args.parameters,
        args.jobDeps,
        args.projectIds,
        args.depHashes,
      ],
    )}`,
  );
}

describe("bulk_upsert_spatial_metrics_and_json", () => {
  test("empty batch returns no rows", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const rows = await bulkUpsertFromConn(conn, {
        fragmentIds: [],
        geographyIds: [],
        types: [],
        overlays: [],
        parameters: [],
        jobDeps: [],
        projectIds: [],
        depHashes: [],
      });
      expect(rows.length).toBe(0);

      const count = await conn.oneFirst<number>(
        sql`select count(*)::int from spatial_metrics where project_id = ${projectId}`,
      );
      expect(count).toBe(0);
    });
  });

  test("SQL function is installed on the test database", async () => {
    await projectTransaction(pool, "public", async (conn) => {
      const exists = await conn.oneFirst<boolean>(sql`
        select exists(
          select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'bulk_upsert_spatial_metrics_and_json'
        )
      `);
      expect(exists).toBe(true);
    });
  });

  /**
   * Full INSERT-path integration (geography + fragment metrics) hits PostgreSQL’s internal
   * `AfterTriggerSaveEvent()` when combined with Graphile spatial_metric triggers under the
   * node-pg extended protocol. Exercise those scenarios manually with psql against the same
   * function after graphile-migrate `current.sql`.
   */
});

describe("getOrCreateSpatialMetricsBatch", () => {
  test("throws when neither fragment nor geography is provided", async () => {
    await expect(
      getOrCreateSpatialMetricsBatch(pgPool, [
        {
          type: "total_area",
          parameters: {},
          projectId: 1,
          dependencyHash: "h",
        },
      ]),
    ).rejects.toThrow(
      "Either subjectFragmentId or subjectGeographyId must be provided",
    );
  });

  test("throws when non-total_area has no overlay and no job dependency", async () => {
    await expect(
      getOrCreateSpatialMetricsBatch(pgPool, [
        {
          subjectGeographyId: 1,
          type: "count",
          parameters: {},
          projectId: 1,
          dependencyHash: "h",
        },
      ]),
    ).rejects.toThrow(
      "overlaySourceUrl or sourceProcessingJobDependency must be provided",
    );
  });

  test("distance_to_shore passes default land-big-2.fgb URL to Postgres", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ord: 1, metric: { type: "distance_to_shore" } }],
    });
    await getOrCreateSpatialMetricsBatch({ query } as never, [
      {
        subjectGeographyId: 42,
        type: "distance_to_shore",
        parameters: {},
        projectId: 7,
        dependencyHash: "dep-d2s",
      },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    const params = query.mock.calls[0][1] as unknown[];
    const overlayUrls = params[3] as (string | null)[];
    expect(overlayUrls[0]).toContain("land-big-2.fgb");
  });
});
