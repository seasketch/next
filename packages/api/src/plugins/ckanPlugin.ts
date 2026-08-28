import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { parseCkanUrl } from "ckan-metadata";
import { loadCkanPackageAndSchema, previewPayload } from "../ckan/resolve";

const CkanPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      type CkanDatasetPreview {
        baseUrl: String!
        datasetId: String!
        datasetPageUrl: String!
        siteTitle: String
        datasetTitle: String
        description: String
        availableLanguages: [String!]!
        schemaAvailable: Boolean!
        fields: JSON!
        document: JSON!
      }

      extend type Query {
        """
        Fetch a CKAN dataset and return the field universe plus a generated
        metadata document for the admin preview UI.
        """
        ckanDatasetPreview(
          url: String!
          config: JSON
          lang: String
        ): CkanDatasetPreview
      }

      extend type Mutation {
        """
        Ensure a project has a ckan_metadata_sources row for the catalogue
        that hosts this dataset URL, creating one with the site title when
        missing.
        """
        ensureCkanMetadataSource(
          projectId: Int!
          url: String!
        ): CkanMetadataSource
      }
    `,
    resolvers: {
      Query: {
        ckanDatasetPreview: async (_parent, args, context) => {
          const { pkg, schema, siteTitle } = await loadCkanPackageAndSchema(
            args.url
          );
          return previewPayload(
            args.url,
            pkg,
            schema,
            siteTitle,
            args.config,
            args.lang
          );
        },
      },
      Mutation: {
        ensureCkanMetadataSource: async (_parent, args, context) => {
          const parsed = parseCkanUrl(args.url);
          if (!parsed) {
            throw new Error("Not a recognized CKAN dataset URL");
          }
          const admin = await context.pgClient.query(
            `select session_is_admin($1) as ok`,
            [args.projectId]
          );
          if (!admin.rows[0]?.ok) {
            throw new Error("Permission denied");
          }
          const existing = await context.pgClient.query(
            `select * from ckan_metadata_sources
             where project_id = $1 and base_url = $2`,
            [args.projectId, parsed.baseUrl]
          );
          if (existing.rows[0]) {
            return existing.rows[0];
          }
          let title: string | null = null;
          try {
            const loaded = await loadCkanPackageAndSchema(args.url);
            title = loaded.siteTitle ?? null;
          } catch {
            title = null;
          }
          const inserted = await context.pgClient.query(
            `insert into ckan_metadata_sources (project_id, base_url, title)
             values ($1, $2, $3)
             on conflict (project_id, base_url) do update
               set title = coalesce(ckan_metadata_sources.title, excluded.title)
             returning *`,
            [args.projectId, parsed.baseUrl, title]
          );
          return inserted.rows[0];
        },
      },
    },
  };
});

export default CkanPlugin;
