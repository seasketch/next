import { Helpers } from "graphile-worker";

export default async function processDataTableUploadOutputs(
  payload: {
    jobId: string;
    data: {
      uploadId: string;
      name: string;
      joinColumn: string;
      overlayJoinColumn: string;
      rowCount: number;
      parquetRemote: string;
      columnStatsRemote: string;
      sourceParquetRemote?: string;
      temporal?: unknown;
      nodataValues?: unknown;
    };
  },
  helpers: Helpers,
) {
  const { jobId, data } = payload;
  helpers.logger.info(`Completing data table upload: ${jobId}`);
  await helpers.withPgClient(async (client) => {
    try {
      if (!data?.parquetRemote || !data?.columnStatsRemote) {
        await client.query(`select fail_overlay_data_table_upload($1, $2)`, [
          jobId,
          "Missing output artifacts from processor",
        ]);
        return;
      }
      await client.query(
        `select complete_overlay_data_table_upload($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
        [
          jobId,
          data.name,
          data.joinColumn,
          data.overlayJoinColumn,
          data.rowCount,
          data.parquetRemote,
          data.columnStatsRemote,
          data.temporal ? JSON.stringify(data.temporal) : null,
          data.nodataValues != null
            ? JSON.stringify(data.nodataValues)
            : null,
          data.sourceParquetRemote ?? null,
        ],
      );
    } catch (e) {
      await client.query(`select fail_overlay_data_table_upload($1, $2)`, [
        jobId,
        (e as Error).message,
      ]);
    }
  });
}
