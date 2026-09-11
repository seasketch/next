import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { GraphQLScalarType, valueFromASTUntyped } from "graphql";
import { isOrganismInfo, OrganismInfo } from "@seasketch/geostats-types";

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
        for an overlay data table. authoredBy is forced to "admin". Does not
        write catalog or search-index sidecars; use the enrichment reprocess
        job for that.
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
          const { rowCount } = await pgClient.query(
            `select id from update_overlay_data_table_organism($2, $1::jsonb)`,
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
