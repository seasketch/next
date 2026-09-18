import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { GraphQLScalarType, valueFromASTUntyped } from "graphql";
import { S3 } from "aws-sdk";
import {
  isOrganismInfo,
  OrganismInfo,
  ORGANISM_SIDECAR_FILES,
} from "@seasketch/geostats-types";

function parseStoredOrganism(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readOrganismField(source: { organism?: unknown }): OrganismInfo | null {
  const value = parseStoredOrganism(source?.organism);
  return isOrganismInfo(value) ? value : null;
}

function validateOrganismInfo(value: unknown): OrganismInfo | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isOrganismInfo(value)) {
    throw new Error(
      "Invalid OrganismInfo document. See @seasketch/geostats-types isOrganismInfo."
    );
  }
  return value;
}

/** Null clears the column. Non-null must pass isOrganismInfo; authoredBy is forced. */
function organismDocumentForAdminWrite(value: unknown): OrganismInfo | null {
  const validated = validateOrganismInfo(value);
  if (validated === null) {
    return null;
  }
  return { ...validated, authoredBy: "admin" };
}

function siblingRemote(parquetRemote: string, filename: string): string | null {
  const suffix = "/data.parquet";
  if (!parquetRemote.endsWith(suffix)) return null;
  return `${parquetRemote.slice(0, -suffix.length)}/${filename}`;
}

async function deleteOrganismSidecars(parquetRemote: unknown) {
  if (typeof parquetRemote !== "string" || !parquetRemote) {
    return;
  }
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return;
  }
  const r2 = new S3({
    region: "auto",
    endpoint,
    signatureVersion: "v4",
    accessKeyId,
    secretAccessKey,
  });
  for (const filename of Object.values(ORGANISM_SIDECAR_FILES)) {
    const remote = siblingRemote(parquetRemote, filename);
    if (!remote || !remote.startsWith("r2://")) continue;
    const parts = remote.replace(/^r2:\/\//, "").split("/");
    const Bucket = parts[0];
    const Key = parts.slice(1).join("/");
    try {
      await r2.deleteObject({ Bucket, Key }).promise();
    } catch (error) {
      console.warn(`Failed to delete organism sidecar ${remote}`, error);
    }
  }
}

const OrganismInfoScalar = new GraphQLScalarType({
  name: "OrganismInfo",
  description:
    "A complete OrganismInfo document for an overlay data table: identity " +
    "column, value kind, and class-table role mapping. Validated against " +
    "@seasketch/geostats-types isOrganismInfo.",
  serialize: (value) => value,
  parseValue: validateOrganismInfo,
  parseLiteral: (ast, variables) =>
    validateOrganismInfo(valueFromASTUntyped(ast, variables)),
});

const OrganismPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      scalar OrganismInfo

      extend type OverlayDataTable {
        """
        Organism identity metadata for this data table. Null when the table
        has not been enriched.
        """
        organism: OrganismInfo @requires(columns: ["organism"])
      }

      extend type Mutation {
        """
        Admin mutation. Sets (or clears, when null) the OrganismInfo document
        for an overlay data table. authoredBy is forced to "admin". Clearing
        also deletes organism catalog, search-index, and preview sidecars when
        no active table still references them. Setting a document does not
        write those files; use the enrichment reprocess job for that.
        """
        updateOverlayDataTableOrganism(
          overlayDataTableId: Int!
          organism: OrganismInfo
        ): OverlayDataTable!
      }
    `,
    resolvers: {
      OrganismInfo: OrganismInfoScalar as any,
      OverlayDataTable: {
        organism: (source) => readOrganismField(source),
      },
      Mutation: {
        updateOverlayDataTableOrganism: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const { overlayDataTableId } = args;
          if (!overlayDataTableId) {
            throw new Error("overlayDataTableId is required");
          }
          const doc = organismDocumentForAdminWrite(args.organism);
          const r = await pgClient.query(
            `select session_is_admin((select project_id from overlay_data_tables where id = $1)) as is_admin`,
            [overlayDataTableId]
          );
          if (!r.rows[0]?.is_admin) {
            throw new Error(
              "Session is not an admin on this overlay data table"
            );
          }
          const tableResult = await pgClient.query(
            `select parquet_remote from overlay_data_tables where id = $1`,
            [overlayDataTableId]
          );
          const { rowCount } = await pgClient.query(
            `select id from update_overlay_data_table_organism($2, $1::jsonb)`,
            [doc ? JSON.stringify(doc) : null, overlayDataTableId]
          );
          if (rowCount === 0) {
            throw new Error("Overlay data table not found");
          }
          if (doc === null) {
            try {
              const parquetRemote = tableResult.rows[0]?.parquet_remote;
              const sharedResult = await pgClient.query(
                `select exists (
                   select 1
                   from overlay_data_tables
                   where id <> $1
                     and deleted_at is null
                     and organism is not null
                     and parquet_remote = $2
                 ) as is_shared`,
                [overlayDataTableId, parquetRemote]
              );
              if (!sharedResult.rows[0]?.is_shared) {
                await deleteOrganismSidecars(parquetRemote);
              }
            } catch (error) {
              console.warn(
                "Failed to delete organism sidecars after clear",
                error
              );
            }
          }
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.overlay_data_tables`,
            (tableAlias: any, queryBuilder: any) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  overlayDataTableId
                )}`
              );
            }
          );
          if (!row) {
            throw new Error("Overlay data table not found");
          }
          return { ...row, organism: doc };
        },
      },
    },
  };
});

export default OrganismPlugin;
