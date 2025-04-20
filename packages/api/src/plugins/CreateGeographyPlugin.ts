import { gql, makeExtendSchemaPlugin } from "graphile-utils";
import { PoolClient } from "pg";

/**
 * Plugin that implements the CreateGeography mutation
 *
 * This mutation allows clients to create a new Geography with associated
 * GeographyClippingLayers. If these layers reference a template_id, they will
 * be cloned into the current project using copy_data_library_template_item.
 */
const CreateGeographyPlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      input GeographyClippingLayerInput {
        """
        If provided, this template layer will be cloned into the project. Either
        templateId or dataLayerId must be provided
        """
        templateId: String

        """
        If provided, this layer will be associated with this geography. Either
        templateId or dataLayerId must be provided
        """
        dataLayerId: Int

        """
        Type of operation to perform on the clipping layer (e.g. intersect, difference).
        """
        operationType: GeographyLayerOperationType!

        """
        If provided, features used for clipping will be filtered based on this
        JSON-encoded OGC Common Query Language (CQL2) query
        """
        cql2Query: JSON
      }

      input CreateGeographyInput {
        """
        Slug of the project to create the geography in
        """
        slug: String!

        """
        Name of the geography
        """
        name: String!

        """
        Clipping layers to associate with this geography
        """
        clippingLayers: [GeographyClippingLayerInput]!

        """
        Translated strings
        """
        translatedProps: JSON
      }

      type CreateGeographyPayload {
        """
        The newly created geography
        """
        geography: Geography
      }

      extend type Mutation {
        """
        Create a new geography with associated clipping layers
        """
        createGeography(input: CreateGeographyInput!): CreateGeographyPayload
      }
    `,

    resolvers: {
      Mutation: {
        createGeography: async (_query, args, context, _resolveInfo) => {
          const { pgClient, adminPool } = context;
          const { input } = args;
          const { slug, name, clippingLayers } = input;

          // Check if user has admin access to the project
          const { rows: adminCheck } = await pgClient.query(
            "select session_is_admin((select id from projects where slug = $1)) as is_admin",
            [slug]
          );

          if (!adminCheck[0].is_admin) {
            throw new Error("You must be an admin to create a geography");
          }

          // First, create the geography
          const { rows: geographyRows } = await pgClient.query(
            "insert into project_geography (project_id, name, translated_props) values ((select id from projects where slug = $1), $2, $3) returning *",
            [
              slug,
              name,
              input.translatedProps
                ? JSON.stringify(input.translatedProps)
                : null,
            ]
          );
          const geography = geographyRows[0];
        },
      },
    },
  };
});

/**
 * Clone a template layer into the project
 */
async function cloneTemplateLayer(
  pgClient: PoolClient,
  templateId: string,
  projectId: number
): Promise<number> {
  // Get the project slug for use in copy_data_library_template_item
  const { rows: projectRows } = await pgClient.query(
    "SELECT slug FROM projects WHERE id = $1",
    [projectId]
  );

  if (projectRows.length === 0) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  const projectSlug = projectRows[0].slug;

  // Call the stored procedure to clone the template item
  const { rows: clonedRows } = await pgClient.query(
    "SELECT * FROM copy_data_library_template_item($1, $2)",
    [templateId, projectSlug]
  );

  if (clonedRows.length === 0) {
    throw new Error(`Failed to clone template layer with ID ${templateId}`);
  }

  return clonedRows[0].id;
}

export default CreateGeographyPlugin;
