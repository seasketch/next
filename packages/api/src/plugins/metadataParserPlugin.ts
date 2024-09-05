import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { metadataToProseMirror } from "@seasketch/metadata-parser";

const MetadataParserPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      extend type Mutation {
        updateTocMetadataFromXML(
          id: Int!
          xmlMetadata: String!
        ): TableOfContentsItem!
      }
    `,
    resolvers: {
      Mutation: {
        updateTocMetadataFromXML: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const data = await metadataToProseMirror(args.xmlMetadata);
          if (data?.doc) {
            const { rows } = await pgClient.query(
              `update public.table_of_contents_items set metadata = $1 where id = $2 returning data_layer_id`,
              [data.doc, args.id]
            );
            if (rows?.[0].data_layer_id && data.attribution) {
              await pgClient.query(
                `update public.data_sources set attribution = $1 where id = any(select data_source_id from data_layers where id = $2)`,
                [data.attribution, rows[0].data_layer_id]
              );
            }
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`public.table_of_contents_items`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(args.id)}`
                  );
                }
              );
            return row;
          } else {
            throw new Error("Invalid metadata");
          }
        },
      },
    },
  };
});

export default MetadataParserPlugin;
