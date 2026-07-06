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
      const uploadsBase =
        process.env.UPLOADS_BASE_URL || process.env.TILES_BASE_URL || "";
      if (uploadsBase) {
        await client.query(
          `select set_config('seasketch.uploads_base_url', $1, true)`,
          [uploadsBase],
        );
      }
      await client.query(
        `select complete_overlay_data_table_upload($1, $2, $3, $4, $5, $6, $7)`,
        [
          jobId,
          data.name,
          data.joinColumn,
          data.overlayJoinColumn,
          data.rowCount,
          data.parquetRemote,
          data.columnStatsRemote,
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
