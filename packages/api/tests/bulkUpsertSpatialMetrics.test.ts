import { sql } from "slonik";
import { raw } from "slonik-sql-tag-raw";
import { createPool, createPgPool } from "./pool";
import { projectTransaction } from "./helpers";
import { getOrCreateSpatialMetricsBatch } from "../src/plugins/reportsPlugin";

const pool = createPool("test");
const pgPool = createPgPool("test");

function uniq(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

jest.setTimeout(1000 * 30);

async function createProjectGeography(
  conn: Parameters<Parameters<typeof projectTransaction>[2]>[0],
  projectId: number,
) {
  const name = `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return conn.oneFirst<number>(
    sql`insert into project_geography (project_id, name) values (${projectId}, ${name}) returning id`,
  );
}

async function resolveBatchFromConn(
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
      FROM resolve_spatial_metrics_batch(
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

describe("resolve_spatial_metrics_batch", () => {
  test("empty batch returns no rows", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const rows = await resolveBatchFromConn(conn, {
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

  test("SQL resolver function is installed on the test database", async () => {
    await projectTransaction(pool, "public", async (conn) => {
      const exists = await conn.oneFirst<boolean>(sql`
        select exists(
          select 1
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'resolve_spatial_metrics_batch'
        )
      `);
      expect(exists).toBe(true);
    });
  });

  test("trigger-driven spatial_metrics queue trigger is removed", async () => {
    await projectTransaction(pool, "public", async (conn) => {
      const exists = await conn.oneFirst<boolean>(sql`
        select exists(
          select 1
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          where c.relname = 'spatial_metrics'
            and t.tgname = 'queue_calculate_spatial_metric_task_trigger'
        )
      `);
      expect(exists).toBe(false);
    });
  });

  test("all metrics cached: second resolve inserts no new spatial_metrics rows", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const geoId = await createProjectGeography(conn, projectId);
      const depHash = uniq("dep");
      const insertedId = await conn.oneFirst<string>(
        sql`
          insert into spatial_metrics (
            subject_fragment_id,
            subject_geography_id,
            type,
            overlay_source_url,
            source_processing_job_dependency,
            project_id,
            parameters,
            dependency_hash,
            state
          )
          values (
            null,
            ${geoId},
            'total_area'::spatial_metric_type,
            null,
            null,
            ${projectId},
            '{}'::jsonb,
            ${depHash},
            'complete'::spatial_metric_state
          )
          returning id::text
        `,
      );

      const rows = await resolveBatchFromConn(conn, {
        fragmentIds: [null],
        geographyIds: [geoId],
        types: ["total_area"],
        overlays: [null],
        parameters: [{}],
        jobDeps: [null],
        projectIds: [projectId],
        depHashes: [depHash],
      });

      expect(rows.length).toBe(1);
      expect(String(rows[0].metric.id)).toBe(insertedId);

      const count = await conn.oneFirst<number>(
        sql`select count(*)::int from spatial_metrics where project_id = ${projectId}`,
      );
      expect(count).toBe(1);
    });
  });

  test("partial miss: inserts only missing metric and preserves input order", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const geoA = await createProjectGeography(conn, projectId);
      const geoB = await createProjectGeography(conn, projectId);
      const depA = uniq("dep-a");
      const depB = uniq("dep-b");

      const idA = await conn.oneFirst<string>(
        sql`
          insert into spatial_metrics (
            subject_fragment_id, subject_geography_id, type,
            overlay_source_url, source_processing_job_dependency,
            project_id, parameters, dependency_hash, state
          )
          values (
            null, ${geoA}, 'total_area'::spatial_metric_type,
            null, null, ${projectId}, '{}'::jsonb, ${depA},
            'complete'::spatial_metric_state
          )
          returning id::text
        `,
      );

      const rows = await resolveBatchFromConn(conn, {
        fragmentIds: [null, null],
        geographyIds: [geoA, geoB],
        types: ["total_area", "total_area"],
        overlays: [null, null],
        parameters: [{}, {}],
        jobDeps: [null, null],
        projectIds: [projectId, projectId],
        depHashes: [depA, depB],
      });

      expect(rows.map((r) => r.ord)).toEqual([1, 2]);
      expect(String(rows[0].metric.id)).toBe(idA);
      expect(rows[1].metric.type).toBe("total_area");
      expect(String(rows[1].metric.id)).not.toBe(idA);

      const count = await conn.oneFirst<number>(
        sql`select count(*)::int from spatial_metrics where project_id = ${projectId}`,
      );
      expect(count).toBe(2);
    });
  });

  test("all missing: inserts each row and returns JSON in order", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const geo1 = await createProjectGeography(conn, projectId);
      const geo2 = await createProjectGeography(conn, projectId);
      const d1 = uniq("d1");
      const d2 = uniq("d2");

      const rows = await resolveBatchFromConn(conn, {
        fragmentIds: [null, null],
        geographyIds: [geo1, geo2],
        types: ["total_area", "total_area"],
        overlays: [null, null],
        parameters: [{}, {}],
        jobDeps: [null, null],
        projectIds: [projectId, projectId],
        depHashes: [d1, d2],
      });

      expect(rows.length).toBe(2);
      expect(rows[0].ord).toBe(1);
      expect(rows[1].ord).toBe(2);
      expect(rows[0].metric.type).toBe("total_area");
      expect(rows[1].metric.type).toBe("total_area");
      expect(rows[0].metric.id).not.toEqual(rows[1].metric.id);

      const count = await conn.oneFirst<number>(
        sql`select count(*)::int from spatial_metrics where project_id = ${projectId}`,
      );
      expect(count).toBe(2);
    });
  });

  test("idempotent second resolve returns same metric ids without extra rows", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const geoId = await createProjectGeography(conn, projectId);
      const dep = uniq("dep");
      const args = {
        fragmentIds: [null],
        geographyIds: [geoId],
        types: ["total_area"],
        overlays: [null],
        parameters: [{}],
        jobDeps: [null],
        projectIds: [projectId],
        depHashes: [dep],
      };

      const first = await resolveBatchFromConn(conn, args);
      const second = await resolveBatchFromConn(conn, args);

      expect(first.length).toBe(1);
      expect(second.length).toBe(1);
      expect(first[0].metric.id).toEqual(second[0].metric.id);

      const count = await conn.oneFirst<number>(
        sql`select count(*)::int from spatial_metrics where project_id = ${projectId}`,
      );
      expect(count).toBe(1);
    });
  });

  test("queues calculateSpatialMetric job for newly inserted queued metric", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const geoId = await createProjectGeography(conn, projectId);
      const dep = uniq("dep-job");

      const rows = await resolveBatchFromConn(conn, {
        fragmentIds: [null],
        geographyIds: [geoId],
        types: ["total_area"],
        overlays: [null],
        parameters: [{}],
        jobDeps: [null],
        projectIds: [projectId],
        depHashes: [dep],
      });

      const metricId = String(rows[0].metric.id);
      const jobCount = await conn.oneFirst<number>(
        sql`
          select count(*)::int
          from graphile_worker.jobs
          where task_identifier = 'calculateSpatialMetric'
            and key = ${`calculateSpatialMetric:${metricId}`}
        `,
      );
      expect(jobCount).toBe(1);
    });
  });

  test("second resolve for same new metric does not add duplicate jobs for same job key", async () => {
    await projectTransaction(pool, "public", async (conn, projectId) => {
      const geoId = await createProjectGeography(conn, projectId);
      const dep = uniq("dep-dedupe");
      const args = {
        fragmentIds: [null],
        geographyIds: [geoId],
        types: ["total_area"],
        overlays: [null],
        parameters: [{}],
        jobDeps: [null],
        projectIds: [projectId],
        depHashes: [dep],
      };

      const first = await resolveBatchFromConn(conn, args);
      const metricId = String(first[0].metric.id);
      await resolveBatchFromConn(conn, args);

      const jobCount = await conn.oneFirst<number>(
        sql`
          select count(*)::int
          from graphile_worker.jobs
          where task_identifier = 'calculateSpatialMetric'
            and key = ${`calculateSpatialMetric:${metricId}`}
        `,
      );
      expect(jobCount).toBe(1);
    });
  });
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

  test("calls resolve_spatial_metrics_batch once (no fallback path)", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ ord: 1, metric: { id: "1", type: "total_area" } }],
    });

    const metrics = await getOrCreateSpatialMetricsBatch({ query } as never, [
      {
        subjectGeographyId: 42,
        type: "total_area",
        parameters: {},
        projectId: 7,
        dependencyHash: "dep-total-area",
      },
    ]);

    expect(metrics).toEqual([{ id: "1", type: "total_area" }]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("resolve_spatial_metrics_batch");
  });
});
