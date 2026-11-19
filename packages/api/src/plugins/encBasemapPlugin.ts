import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { storageClientV2 } from "../storage/client";

const MAX_FILES = 20;
const PRESIGN_SECONDS = 60 * 60;

type UploadRow = {
  job_id: string;
  state: string;
  progress: number | null;
  progress_message: string | null;
  error_message: string | null;
  basemap_id: number | null;
};

function jobPayload(row: UploadRow) {
  return {
    jobId: row.job_id,
    state: row.state,
    progress: row.progress,
    progressMessage: row.progress_message,
    errorMessage: row.error_message,
    basemapId: row.basemap_id,
  };
}

function safeFilename(name: string, index: number): string {
  const base = (name.split(/[/\\]/).pop() || `cell-${index}`).replace(
    /[^A-Za-z0-9._-]/g,
    "_"
  );
  if (!/\.(zip|000)$/i.test(base)) {
    throw new Error(
      "Drop S-57 zip files or .000 cells. Encrypted S-63 charts are not supported."
    );
  }
  return base;
}

const EncBasemapPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    type EncChartFileUpload {
      filename: String!
      url: String!
      contentType: String!
    }

    type EncChartUpload {
      jobId: UUID!
      uploads: [EncChartFileUpload!]!
    }

    type EncBasemapJob {
      jobId: UUID!
      state: String!
      progress: Float
      progressMessage: String
      errorMessage: String
      basemapId: Int
    }

    extend type Query {
      encBasemapJob(jobId: UUID!): EncBasemapJob
    }

    extend type Mutation {
      """
      Presign one PUT per S-57 file. The chart is not built until
      submitEncBasemapUpload. Charts built this way are public.
      """
      createEncBasemapUpload(
        projectId: Int!
        name: String!
        filenames: [String!]!
      ): EncChartUpload!

      submitEncBasemapUpload(jobId: UUID!): EncBasemapJob!
    }
  `,
  resolvers: {
    Query: {
      encBasemapJob: async (_parent, args, context) => {
        const { pgClient } = context;
        if (!pgClient) throw new Error("Unauthorized");
        const { rows } = await pgClient.query(
          `select u.job_id, j.state, j.progress, j.progress_message, j.error_message, u.basemap_id
           from enc_basemap_uploads u
           join project_background_jobs j on j.id = u.job_id
           where u.job_id = $1
             and session_is_admin(u.project_id)`,
          [args.jobId]
        );
        if (rows.length === 0) return null;
        return jobPayload(rows[0]);
      },
    },
    Mutation: {
      createEncBasemapUpload: async (_parent, args, context) => {
        const { pgClient, adminPool, user } = context;
        if (!pgClient || !adminPool || !user?.id) throw new Error("Unauthorized");
        const name = String(args.name || "").trim();
        if (!name) throw new Error("Name the chart");
        if (name.length > 80) throw new Error("Name must be 80 characters or fewer");
        const filenames = args.filenames as string[];
        if (!Array.isArray(filenames) || filenames.length === 0) {
          throw new Error("Drop at least one S-57 file");
        }
        if (filenames.length > MAX_FILES) {
          throw new Error(`Drop at most ${MAX_FILES} files at a time`);
        }
        const admin = await pgClient.query(
          `select session_is_admin($1::int) as is_admin`,
          [args.projectId]
        );
        if (!admin.rows[0]?.is_admin) throw new Error("Unauthorized");
        const bucket = process.env.SPATIAL_UPLOADS_BUCKET;
        if (!bucket) throw new Error("Uploads are not configured");

        const seen = new Set<string>();
        const storedNames = filenames.map((filename, index) => {
          let safe = safeFilename(filename, index);
          if (seen.has(safe.toLowerCase())) {
            const dot = safe.lastIndexOf(".");
            safe = `${safe.slice(0, dot)}-${index}${safe.slice(dot)}`;
          }
          seen.add(safe.toLowerCase());
          return safe;
        });

        const created = await adminPool.query(
          `insert into project_background_jobs (
             project_id, title, user_id, type, progress_message, timeout_at
           ) values (
             $1, $2, $3, 'data_upload', 'uploading',
             timezone('utc', now()) + interval '30 minutes'
           ) returning id`,
          [args.projectId, name, user.id]
        );
        const jobId = created.rows[0].id as string;
        const objectKeys = storedNames.map((filename) => `enc/${jobId}/${filename}`);
        await adminPool.query(
          `insert into enc_basemap_uploads (job_id, project_id, name, object_keys)
           values ($1, $2, $3, $4)`,
          [jobId, args.projectId, name, objectKeys]
        );
        const s3 = storageClientV2();
        const uploads = await Promise.all(
          storedNames.map(async (filename, index) => ({
            filename,
            contentType: "application/octet-stream",
            url: await s3.getSignedUrlPromise("putObject", {
              Bucket: bucket,
              Key: objectKeys[index],
              Expires: PRESIGN_SECONDS,
              ContentType: "application/octet-stream",
            }),
          }))
        );
        return { jobId, uploads };
      },
      submitEncBasemapUpload: async (_parent, args, context) => {
        const { pgClient, adminPool } = context;
        if (!pgClient || !adminPool) throw new Error("Unauthorized");
        const { rows } = await pgClient.query(
          `select u.job_id, j.state, j.progress, j.progress_message, j.error_message, u.basemap_id
           from enc_basemap_uploads u
           join project_background_jobs j on j.id = u.job_id
           where u.job_id = $1
             and session_is_admin(u.project_id)`,
          [args.jobId]
        );
        if (rows.length === 0) throw new Error("Upload not found");
        const row = rows[0] as UploadRow;
        if (row.state === "queued" && row.progress_message === "uploading") {
          await adminPool.query(
            `update project_background_jobs
             set progress_message = 'queued', progress = 0
             where id = $1`,
            [args.jobId]
          );
          await adminPool.query(
            `select graphile_worker.add_job(
               'processEncBasemap',
               json_build_object('jobId', $1::text),
               max_attempts := 1
             )`,
            [args.jobId]
          );
          row.progress_message = "queued";
          row.progress = 0;
        }
        return jobPayload(row);
      },
    },
  },
}));

export default EncBasemapPlugin;
