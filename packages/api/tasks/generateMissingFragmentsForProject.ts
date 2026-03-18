import { Helpers } from "graphile-worker";

/**
 * Queues ensureSketchFragments for each sketch and collection in the project
 * that uses geography clipping or preview-new-reports and does not already have
 * fragments. Does not delete any existing fragments. Skips FILTERED_PLANNING_UNITS.
 */
export default async function generateMissingFragmentsForProject(
  payload: { projectId: number },
  helpers: Helpers,
) {
  await helpers.withPgClient(async (client) => {
    const { rows } = await client.query<{ id: number; geometry_type: string }>(
      `
      select s.id, sc.geometry_type
      from sketches s
      join sketch_classes sc on sc.id = s.sketch_class_id
      where sc.project_id = $1
        and (sc.geometry_type = 'POLYGON' or sc.geometry_type = 'COLLECTION')
        and (
          sketch_classes_use_geography_clipping(sc.*)
          or coalesce(sc.preview_new_reports, false)
        )
        and not exists (
          select 1 from sketch_fragments sf where sf.sketch_id = s.id
        )
      order by
        case when sc.geometry_type = 'COLLECTION' then 0 else 1 end asc,
        s.id asc
      `,
      [payload.projectId],
    );

    for (const row of rows) {
      if (row.geometry_type === "COLLECTION") {
        console.error(`Collection ${row.id} is not supported yet`);
        continue;
      }
      await helpers.addJob(
        "ensureSketchFragments",
        { sketchId: row.id, projectId: payload.projectId },
        {
          jobKey: `fragments:sketch:${row.id}`,
          queueName: "sketch-fragments",
          maxAttempts: 2,
        },
      );
    }
  });
}
