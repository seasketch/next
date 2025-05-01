import { deepStrictEqual } from "assert";
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
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      input ClippingLayerInput {
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
        operationType: GeographyLayerOperation!

        """
        If provided, features used for clipping will be filtered based on this
        JSON-encoded OGC Common Query Language (CQL2) query
        """
        cql2Query: JSON
      }

      input CreateGeographyArgs {
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
        clippingLayers: [ClippingLayerInput]!

        """
        Translated strings
        """
        translatedProps: JSON

        """
        Used to identify Geographies that are created using a particular wizard
        flow like "Pick an EEZ" or "Terrestrial Areas".
        """
        clientTemplate: String
      }

      type CreateGeographiesPayload {
        """
        The newly created geography
        """
        geographies: [Geography!]!
      }

      extend type Mutation {
        """
        Create a new geography with associated clipping layers
        """
        createGeographies(
          input: [CreateGeographyArgs!]!
        ): CreateGeographiesPayload
      }
    `,

    resolvers: {
      CreateGeographiesPayload: {
        geographies: async (results, args, context, resolveInfo) => {
          return resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`project_geography`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = any(${sql.value(
                  context.createdGeographyIds
                )})`
              );
            }
          );
        },
      },
      Mutation: {
        createGeographies: async (_query, args, context, resolveInfo) => {
          console.log("create geography", args);
          const { pgClient, adminPool } = context;
          const { input: inputs } = args;

          // make sure all inputs share the same slug
          const slugs = new Set(inputs.map((input: any) => input.slug));
          if (slugs.size !== 1) {
            throw new Error("All inputs must have the same slug");
          }

          const createdGeographyIds = [] as number[];
          for (const input of inputs) {
            console.log("processing", input);
            const { slug, name, clippingLayers, clientTemplate } = input;
            if (!slug || !name || clippingLayers.length === 0) {
              throw new Error(
                "slug, name, and at least one clipping layer are required"
              );
            }
            // Check if user has admin access to the project
            const isAdmin = await sessionIsAdmin(slug, pgClient);
            if (!isAdmin) {
              throw new Error(
                "You do not have permission to create a geography"
              );
            }

            const projectId = await idForSlug(slug, pgClient);

            // First, create the geography
            const { rows: geographyRows } = await pgClient.query(
              "insert into project_geography (project_id, name, translated_props, client_template) values ((select id from projects where slug = $1), $2, $3, $4) returning *",
              [
                slug,
                name,
                input.translatedProps
                  ? JSON.stringify(input.translatedProps)
                  : null,
                clientTemplate || null,
              ]
            );
            const geography = geographyRows[0];
            if (!geography) {
              throw new Error("Failed to create geography");
            }
            createdGeographyIds.push(geography.id);

            // Then create the geography_clipping_layers
            const clippingLayerIds = [] as number[];
            for (const layerInput of clippingLayers) {
              const { templateId, dataLayerId, operationType, cql2Query } =
                layerInput;

              if (!templateId && !dataLayerId) {
                throw new Error(
                  "Either templateId or dataLayerId must be provided for each clipping layer"
                );
              }

              let layerId: number | null = null;
              if (templateId) {
                // Clone the template layer into the project
                layerId = await getOrCloneTemplateLayer(
                  pgClient,
                  templateId,
                  slug,
                  cql2Query,
                  name
                );
              } else {
                // ensure layer exists in project
                const { rows: dataLayerRows } = await pgClient.query(
                  "select id from data_layers where id = $1 and project_id = $2",
                  [dataLayerId, projectId]
                );
                if (dataLayerRows.length === 0) {
                  throw new Error(
                    `Data layer with ID ${dataLayerId} does not exist in project ${slug}`
                  );
                }
                // Use the provided dataLayerId directly
                layerId = dataLayerId;
              }

              // Insert the clipping layer
              const { rows: layerRows } = await pgClient.query(
                "insert into geography_clipping_layers (project_geography_id, data_layer_id, operation_type, cql2_query, template_id) values ($1, $2, $3, $4, $5) returning *",
                [
                  geography.id,
                  layerId,
                  operationType,
                  cql2Query ? cql2Query : null,
                  templateId || null,
                ]
              );
              clippingLayerIds.push(layerRows[0].id);
            }
          }
          context.createdGeographyIds = createdGeographyIds;
          return {};
        },
      },
    },
  };
});

/**
 * Clone a template layer into the project
 */
async function getOrCloneTemplateLayer(
  pgClient: PoolClient,
  templateId: string,
  slug: string,
  cql2Query: string | null,
  label: string | null = null
): Promise<number> {
  console.log("getOrClone");
  const filterExpression = cql2ToFilterExpression(cql2Query);
  console.log(
    "filterExpression",
    filterExpression,
    cql2Query,
    typeof cql2Query
  );
  // First, check if a data layer exists in the project with the same template
  // id and filter expression
  const { rows: existingRows } = await pgClient.query(
    `
      SELECT 
        id, 
        mapbox_gl_styles 
      FROM 
        data_layers 
      WHERE 
        project_id = (SELECT id FROM projects WHERE slug = $1) AND data_source_id in (
          SELECT id FROM data_sources WHERE data_library_template_id = $2
        )
    `,
    [slug, templateId]
  );
  console.log("existing", existingRows);
  const matches = existingRows.filter((row) => {
    for (const layer of row.mapbox_gl_styles || []) {
      if (JSON.stringify(layer.filter) === JSON.stringify(filterExpression)) {
        return true;
      }
    }
    return false;
  });

  if (matches.length) {
    // return related, draft, table_of_contents_item
    const { rows: tocRows } = await pgClient.query(
      `
      select
        id,
        data_layer_id
      from
        table_of_contents_items
      where
        data_layer_id = any($1) and is_draft = true
    `,
      [matches.map((match) => match.id)]
    );
    if (tocRows.length) {
      return tocRows[0].data_layer_id;
    }
  }
  // Call the stored procedure to clone the template item
  const { rows: clonedRows } = await pgClient.query(
    "SELECT * FROM copy_data_library_template_item($1, $2)",
    [templateId, slug]
  );

  if (clonedRows.length === 0) {
    throw new Error(`Failed to clone template layer with ID ${templateId}`);
  }

  const data_layer_id = clonedRows[0].data_layer_id;

  if (filterExpression !== undefined) {
    console.log("update style");
    // Update the filter expression for the cloned layer
    // first, get the mapbox_gl_styles for the cloned layer
    const { rows: clonedLayerRows } = await pgClient.query(
      "SELECT mapbox_gl_styles FROM data_layers WHERE id = $1",
      [data_layer_id]
    );
    const clonedLayer = clonedLayerRows[0];
    if (!clonedLayer) {
      throw new Error(`Failed to find cloned layer with ID ${data_layer_id}`);
    }
    const mapboxGlStyles = clonedLayer.mapbox_gl_styles;
    console.log("mapboxGlStyles", mapboxGlStyles);
    if (!mapboxGlStyles) {
      throw new Error(
        `Failed to find mapbox_gl_styles for cloned layer with ID ${data_layer_id}`
      );
    }
    // Update the filter expression for each layer
    const updatedStyles = mapboxGlStyles.map((style: any) => {
      return {
        ...style,
        filter: filterExpression,
      };
    });
    console.log("updatedStyles", updatedStyles);
    // Update the data layer with the new filter expression
    await pgClient.query(
      "UPDATE data_layers SET mapbox_gl_styles = $1::jsonb WHERE id = $2",
      [JSON.stringify(updatedStyles), data_layer_id]
    );
  }

  if (label !== null) {
    // update the style with special metadata for labels
    // first get the mapbox_gl_styles for the cloned layer
    const { rows: clonedLayerRows } = await pgClient.query(
      "SELECT mapbox_gl_styles FROM data_layers WHERE id = $1",
      [data_layer_id]
    );
    const clonedLayer = clonedLayerRows[0];
    if (!clonedLayer) {
      throw new Error(`Failed to find cloned layer with ID ${data_layer_id}`);
    }
    const mapboxGlStyles = clonedLayer.mapbox_gl_styles;
    if (!mapboxGlStyles) {
      throw new Error(
        `Failed to find mapbox_gl_styles for cloned layer with ID ${data_layer_id}`
      );
    }
    // Update the label for each layer
    const updatedStyles = mapboxGlStyles.map((style: any) => {
      return {
        ...style,
        metadata: {
          ...(style.metadata || {}),
          label: " ",
        },
      };
    });
    // Update the data layer with the new label
    await pgClient.query(
      "UPDATE data_layers SET mapbox_gl_styles = $1::jsonb WHERE id = $2",
      [JSON.stringify(updatedStyles), data_layer_id]
    );
    // update the table of contents item with the label
    await pgClient.query(
      "UPDATE table_of_contents_items SET title = $1 WHERE data_layer_id = $2 and is_draft = true",
      [label, data_layer_id]
    );
  }

  return data_layer_id;
}

export async function sessionIsAdmin(
  projectIdOrSlug: string | number,
  pgClient: PoolClient
): Promise<boolean> {
  if (typeof projectIdOrSlug === "string") {
    const { rows } = await pgClient.query(
      "SELECT session_is_admin((SELECT id FROM projects WHERE slug = $1)) AS is_admin",
      [projectIdOrSlug]
    );
    return Boolean(rows[0].is_admin);
  } else if (typeof projectIdOrSlug === "number") {
    const { rows } = await pgClient.query(
      "SELECT session_is_admin($1) AS is_admin",
      [projectIdOrSlug]
    );
    return Boolean(rows[0].is_admin);
  } else {
    throw new Error(
      "projectIdOrSlug must be a string (slug) or a number (project ID)"
    );
  }
}

export async function idForSlug(
  slug: string,
  pool: PoolClient
): Promise<number> {
  const { rows } = await pool.query("SELECT id FROM projects WHERE slug = $1", [
    slug,
  ]);
  if (rows.length === 0) {
    throw new Error(`Project with slug ${slug} not found`);
  }
  return rows[0].id;
}

/**
 * Converts a cql2 query to a mapbox-gl-style expression that can be used to
 * filter features by properties. For example:
 * {"op": "=", "args": [{"property": "MRGID_EEZ", "value": 1}]}
 * becomes ["==", ["get", "MRGID_EEZ"], 1]
 * @param cql2Query
 */
function cql2ToFilterExpression(filter: any): any {
  if (!filter) return undefined;
  if (typeof filter === "string") {
    try {
      filter = JSON.parse(filter);
    } catch (e) {
      return undefined;
    }
  }

  const opMap: Record<string, string> = {
    "=": "==",
    "!=": "!=",
    "<": "<",
    "<=": "<=",
    ">": ">",
    ">=": ">=",
    and: "all",
    or: "any",
    not: "!",
    in: "in",
    like: "match",
  };

  function parseArg(arg: any): any {
    if (arg && typeof arg === "object" && "property" in arg) {
      return ["get", arg.property];
    }
    if (arg && typeof arg === "object" && "value" in arg) {
      return arg.value;
    }
    return arg;
  }

  if (filter.op) {
    const op = opMap[filter.op] || filter.op;
    const args = filter.args || [];

    if (op === "all" || op === "any") {
      return [op, ...args.map(cql2ToFilterExpression)];
    }
    if (op === "!") {
      return ["!", cql2ToFilterExpression(args[0])];
    }
    if (op === "in") {
      // ["in", ["get", "prop"], v1, v2, ...]
      const property = parseArg(args[0]);
      const values = args.slice(1).map(parseArg);
      return ["in", property, ["literal", ...values]];
    }
    if (op === "match") {
      // ["match", ["get", "prop"], [pattern], true, false]
      const property = parseArg(args[0]);
      const pattern = args[1]?.value || args[1];
      // Mapbox GL doesn't support SQL LIKE, so treat as equality or RegExp
      return ["match", property, [pattern], true, false];
    }
    // Default binary op: ["==", ["get", "prop"], value]
    if (args.length === 2) {
      return [op, parseArg(args[0]), parseArg(args[1])];
    }
  }
  return undefined;
}

export default CreateGeographyPlugin;
