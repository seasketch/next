import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { GraphQLScalarType, valueFromASTUntyped } from "graphql";
import { isTemporalInfo, TemporalInfo } from "@seasketch/geostats-types";

/**
 * Exposes TemporalInfo metadata (design-docs/temporal-data/temporal-data.md)
 * on data_sources (vector, raster, and remote layers) and overlay_data_tables.
 * The raw jsonb columns are @omit'd in the schema; this plugin publishes them
 * as a validated `TemporalInfo` scalar and provides the admin mutations that
 * write them. The whole document is read and written at once (no GraphQL
 * object unions) because admin/ingest write it whole and the timeslider
 * reads it whole.
 */

function validateTemporalInfo(value: unknown): TemporalInfo | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!isTemporalInfo(value)) {
    throw new Error(
      "Invalid TemporalInfo document. See @seasketch/geostats-types isTemporalInfo."
    );
  }
  return value;
}

/** Null clears the column. Non-null must pass isTemporalInfo; authoredBy is forced. */
function temporalDocumentForAdminWrite(value: unknown): TemporalInfo | null {
  const validated = validateTemporalInfo(value);
  if (validated === null) {
    return null;
  }
  return { ...validated, authoredBy: "admin" };
}

const TemporalInfoScalar = new GraphQLScalarType({
  name: "TemporalInfo",
  description:
    "A complete TemporalInfo document for a data source or data table: " +
    "coverage, resolution, how time is mapped (layer, feature, band, row, " +
    "or remote), and availability. Applies to vector, raster, and remote " +
    "layers as well as Data Tables. Validated against " +
    "@seasketch/geostats-types isTemporalInfo.",
  serialize: (value) => value,
  parseValue: validateTemporalInfo,
  parseLiteral: (ast, variables) =>
    validateTemporalInfo(valueFromASTUntyped(ast, variables)),
});

const TemporalPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      scalar TemporalInfo

      extend type DataSource {
        """
        Temporal metadata for this source: coverage, resolution, mapping
        (layer, feature, band, or remote), and availability. Used for vector,
        raster, and remote layers. Null when the source has none.
        """
        temporal: TemporalInfo @requires(columns: ["temporal"])
      }

      extend type OverlayDataTable {
        """
        Temporal metadata for this data table: coverage, resolution, row
        mapping, and availability. Null when the table has none.
        """
        temporal: TemporalInfo @requires(columns: ["temporal"])
      }

      extend type Mutation {
        """
        Admin mutation. Sets (or clears, when null) the TemporalInfo document
        for a data source. authoredBy is forced to "admin".
        """
        updateDataSourceTemporal(
          dataSourceId: Int!
          temporal: TemporalInfo
        ): DataSource!

        """
        Admin mutation. Sets (or clears, when null) the TemporalInfo document
        for an overlay data table. authoredBy is forced to "admin".
        """
        updateOverlayDataTableTemporal(
          overlayDataTableId: Int!
          temporal: TemporalInfo
        ): OverlayDataTable!
      }
    `,
    resolvers: {
      // graphile-utils' Resolvers type doesn't model scalar resolvers, but
      // makeExtendSchemaPlugin supports GraphQLScalarType at runtime.
      TemporalInfo: TemporalInfoScalar as any,
      DataSource: {
        // Defensive: never surface a malformed stored document.
        temporal: (source) =>
          isTemporalInfo(source.temporal) ? source.temporal : null,
      },
      OverlayDataTable: {
        temporal: (source) =>
          isTemporalInfo(source.temporal) ? source.temporal : null,
      },
      Mutation: {
        updateDataSourceTemporal: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const { dataSourceId } = args;
          if (!dataSourceId) {
            throw new Error("dataSourceId is required");
          }
          const doc = temporalDocumentForAdminWrite(args.temporal);
          const r = await pgClient.query(
            `select session_is_admin((select project_id from data_sources where id = $1)) as is_admin`,
            [dataSourceId]
          );
          if (!r.rows[0]?.is_admin) {
            throw new Error("Session is not an admin on this data source");
          }
          // Must use the GraphQL session connection (not adminPool) so
          // session.user_id is set and the changelog trigger records the edit.
          const { rowCount } = await pgClient.query(
            `update data_sources set temporal = $1::jsonb where id = $2`,
            [doc ? JSON.stringify(doc) : null, dataSourceId]
          );
          if (rowCount === 0) {
            throw new Error("Data source not found");
          }
          const [row] = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`public.data_sources`,
            (tableAlias: any, queryBuilder: any) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(dataSourceId)}`
              );
            }
          );
          return row;
        },
        updateOverlayDataTableTemporal: async (
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
          const doc = temporalDocumentForAdminWrite(args.temporal);
          const r = await pgClient.query(
            `select session_is_admin((select project_id from overlay_data_tables where id = $1)) as is_admin`,
            [overlayDataTableId]
          );
          if (!r.rows[0]?.is_admin) {
            throw new Error(
              "Session is not an admin on this overlay data table"
            );
          }
          // SECURITY DEFINER helper: overlay_data_tables has no column UPDATE
          // grant (SELECT-only for seasketch_user). session.user_id is still
          // the GraphQL session because this runs on pgClient.
          const { rowCount } = await pgClient.query(
            `select id from update_overlay_data_table_temporal($2, $1::jsonb)`,
            [doc ? JSON.stringify(doc) : null, overlayDataTableId]
          );
          if (rowCount === 0) {
            throw new Error("Overlay data table not found");
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
          return row;
        },
      },
    },
  };
});

export default TemporalPlugin;
