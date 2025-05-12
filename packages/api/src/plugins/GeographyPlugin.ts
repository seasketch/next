import { gql, makeExtendSchemaPlugin } from "graphile-utils";
import { PoolClient } from "pg";

/**
 * Plugin that implements the CreateGeography mutation
 *
 * This mutation allows clients to create a new Geography with associated
 * GeographyClippingLayers. If these layers reference a template_id, they will
 * be cloned into the current project using copy_data_library_template_item.
 */
const GeographyPlugin = makeExtendSchemaPlugin((build) => {
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

      type UpdateClippingLayerPayload {
        operationType: GeographyLayerOperation
        cql2Query: JSON
      }

      type GeographyUpdatedPayload {
        geography: Geography!
      }

      input UpdateProjectGeographyPayload {
        name: String
        translatedProps: JSON
        clippingLayers: [ClippingLayerInput]
      }

      extend type Mutation {
        """
        Create a new geography with associated clipping layers
        """
        createGeographies(
          input: [CreateGeographyArgs!]!
        ): CreateGeographiesPayload

        deleteGeographyAndTableOfContentsItems(
          id: Int!
          deleteRelatedTableOfContentsItems: Boolean
        ): Geography!

        updateProjectGeography(
          id: Int!
          input: UpdateProjectGeographyPayload!
        ): GeographyUpdatedPayload!
      }

      extend type Geography {
        bounds: [Float!]
      }

      extend type GeographyClippingLayer {
        bounds: [Float!] @requires(columns: ["cql2Query", "templateId"])
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
      GeographyUpdatedPayload: {
        geography: async (_query, args, context, resolveInfo) => {
          const rows = await resolveInfo.graphile.selectGraphQLResultFromTable(
            sql.fragment`project_geography`,
            (tableAlias, queryBuilder) => {
              queryBuilder.where(
                sql.fragment`${tableAlias}.id = ${sql.value(
                  context.geographyId
                )}`
              );
            }
          );
          return rows[0];
        },
      },
      GeographyClippingLayer: {
        bounds: async (clippingLayer, args, context, resolveInfo) => {
          const { pgClient } = context;
          // get the data source url for this clipping layer
          const { rows: dataLayerRows } = await pgClient.query(
            `SELECT
              data_sources.url as url,
              geography_clipping_layers_object_key(geography_clipping_layers.*) as object_key
            FROM
              geography_clipping_layers
            INNER JOIN
              data_layers ON geography_clipping_layers.data_layer_id = data_layers.id
            INNER JOIN
              data_sources ON data_layers.data_source_id = data_sources.id
            WHERE
              geography_clipping_layers.id = $1`,
            [clippingLayer.id]
          );
          if (dataLayerRows.length === 0) {
            return null;
          }
          const dataSourceUrl = dataLayerRows[0].url;
          const objectKey = dataLayerRows[0].object_key;
          const { cql2Query, templateId } = clippingLayer;
          // Don't return a bounding box for the whole planet
          if (templateId === "DAYLIGHT_COASTLINE") {
            return null;
          }
          const bounds = await getBoundsForClippingLayer(
            dataSourceUrl,
            objectKey,
            cql2Query,
            clippingLayer.templateId
          );
          return bounds;
        },
      },

      Geography: {
        bounds: async (geography, args, context, resolveInfo) => {
          // get related clipping layers
          const { pgClient } = context;
          const bounds: number[][] = [];
          const { id: geographyId } = geography;
          const { rows: clippingLayerRows } = await pgClient.query(
            `
            select
              geography_clipping_layers.id,
              geography_clipping_layers.cql2_query,
              geography_clipping_layers.template_id,
              geography_clipping_layers_object_key(geography_clipping_layers.*) as object_key,
              data_sources.url as url
            from
              geography_clipping_layers
            inner join
              data_layers on geography_clipping_layers.data_layer_id = data_layers.id
            inner join
              data_sources on data_layers.data_source_id = data_sources.id
            where
              geography_clipping_layers.project_geography_id = $1
          `,
            [geographyId]
          );
          await Promise.all(
            (
              (clippingLayerRows || []) as {
                id: number;
                cql2_query?: string;
                template_id?: string;
                url: string;
                object_key: string;
              }[]
            ).map(async ({ cql2_query, template_id, url, object_key }) => {
              if (
                template_id === "DAYLIGHT_COASTLINE" ||
                template_id === "MARINE_REGIONS_HIGH_SEAS"
              ) {
                // don't return a bounding box for the whole planet
                return;
              }
              const bbox = await getBoundsForClippingLayer(
                url,
                object_key,
                cql2_query,
                template_id
              );
              bounds.push(bbox);
            })
          );
          if (bounds.length === 0) {
            return null;
          } else {
            return combineBBoxes(bounds);
          }
        },
      },
      Mutation: {
        updateProjectGeography: async (_query, args, context, resolveInfo) => {
          const { pgClient } = context;
          const { id, input } = args;
          const { name, translatedProps, clippingLayers } = input;
          // ensure user is an admin and the geography exists
          const isAdmin = await sessionIsAdmin(id, pgClient);
          if (!isAdmin) {
            throw new Error(
              "You do not have permission to update this geography"
            );
          }
          const { rows: geographyRows } = await pgClient.query(
            "SELECT * FROM project_geography WHERE id = $1",
            [id]
          );
          if (geographyRows.length === 0) {
            throw new Error(`Geography with ID ${id} does not exist`);
          }
          // first, update the geography name and translated_props, if provided
          const updateFields: string[] = [];
          const updateValues: any[] = [];
          if (name) {
            updateFields.push("name = $2");
            updateValues.push(name);
          }
          if (translatedProps) {
            updateFields.push(
              `translated_props = $${
                updateFields.length > 0 ? updateFields.length + 1 : 2
              }`
            );
            updateValues.push(JSON.stringify(translatedProps));
          }
          if (updateFields.length > 0) {
            await pgClient.query(
              `UPDATE project_geography SET ${updateFields.join(
                ", "
              )} WHERE id = $1`,
              [id, ...updateValues]
            );
          }
          if (Array.isArray(clippingLayers)) {
            // For clipping layers, we assume that a geography can only have a
            // single clipping layer per referenced data layer. We also assume
            // that if a clipping layers list is provided, it is exhaustive. So,
            //   * If a clipping layer exists, but one with a matching
            //     data_layer_id is not in the input, it needs to be deleted
            //   * If a clipping layer with a new data_layer_id exists in the list
            //     but not in the db, it's a new clipping layer that needs to be
            //     created
            //   * If there's a clipping layer input with a matching data_layer_id
            //     in the db, that clipping layer needs to be updated

            // first, get existing clipping layers for this geography
            const { rows: existingClippingLayers } = await pgClient.query(
              `            
              SELECT 
                id, 
                data_layer_id, 
                operation_type, 
                cql2_query, 
                template_id 
              from 
                geography_clipping_layers 
              WHERE project_geography_id = $1
            `,
              [id]
            );
            // determine which clipping layers to delete, update, or create
            const existingLayerMap: Record<number, any> = {};
            for (const layer of existingClippingLayers) {
              existingLayerMap[layer.data_layer_id] = layer;
            }
            const clippingLayerIdsToDelete: number[] = [];
            const clippingLayersToCreate: any[] = [];
            const clippingLayersToUpdate: any[] = [];
            for (const layerInput of clippingLayers) {
              const { dataLayerId, operationType, cql2Query } = layerInput;
              if (!dataLayerId) {
                throw new Error(
                  "dataLayerId is required for each clipping layer"
                );
              }
              if (dataLayerId in existingLayerMap) {
                // This clipping layer exists, so update it
                const existingLayer = existingLayerMap[dataLayerId];
                clippingLayersToUpdate.push({
                  id: existingLayer.id,
                  operationType: operationType || existingLayer.operation_type,
                  cql2Query: cql2Query,
                });
              } else {
                // This clipping layer does not exist, so create it
                clippingLayersToCreate.push({
                  dataLayerId,
                  operationType,
                  cql2Query,
                  templateId: layerInput.templateId || null,
                });
              }
            }
            // Now determine which existing clipping layers to delete
            for (const existingLayer of existingClippingLayers) {
              if (
                !clippingLayers.some(
                  (layer: { dataLayerId: number }) =>
                    layer.dataLayerId === existingLayer.data_layer_id
                )
              ) {
                // This clipping layer is not in the input, so delete it
                clippingLayerIdsToDelete.push(existingLayer.id);
              }
            }
            // Perform deletions
            if (clippingLayerIdsToDelete.length > 0) {
              await pgClient.query(
                `DELETE FROM geography_clipping_layers WHERE id = ANY($1)`,
                [clippingLayerIdsToDelete]
              );
            }
            // Perform updates
            for (const layer of clippingLayersToUpdate) {
              const { id, operationType, cql2Query } = layer;
              await pgClient.query(
                `UPDATE geography_clipping_layers SET operation_type = $1, cql2_query = $2 WHERE id = $3`,
                [operationType, cql2Query, id]
              );
            }
            // Perform creations
            for (const layer of clippingLayersToCreate) {
              const { dataLayerId, operationType, cql2Query, templateId } =
                layer;
              await pgClient.query(
                `INSERT INTO geography_clipping_layers (project_geography_id, data_layer_id, operation_type, cql2_query, template_id) VALUES ($1, $2, $3, $4, $5)`,
                [
                  id,
                  dataLayerId,
                  operationType,
                  cql2Query ? JSON.stringify(cql2Query) : null,
                  templateId || null,
                ]
              );
            }
          }
          context.geographyId = id;
          return {};
        },
        deleteGeographyAndTableOfContentsItems: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          const { id, deleteRelatedTableOfContentsItems } = args;

          // Check if user has admin access to the project
          const isAdmin = await sessionIsAdmin(id, pgClient);
          if (!isAdmin) {
            throw new Error(
              "You do not have permission to delete this geography"
            );
          }

          if (deleteRelatedTableOfContentsItems) {
            // Only delete table_of_contents_items for layers that will no longer be referenced by any geography_clipping_layers after this geography is deleted
            await pgClient.query(
              `
                DELETE FROM table_of_contents_items
                WHERE data_layer_id IN (
                  SELECT data_layer_id
                  FROM geography_clipping_layers
                  WHERE project_geography_id = $1
                    AND data_layer_id IS NOT NULL
                    AND (
                      SELECT COUNT(*)
                      FROM geography_clipping_layers
                      WHERE data_layer_id = geography_clipping_layers.data_layer_id
                        AND project_geography_id != $1
                    ) = 0
                )
              `,
              [id]
            );
          }
          const { rows } = await pgClient.query(
            "DELETE FROM project_geography WHERE id = $1 returning *",
            [id]
          );

          return rows[0];
        },
        createGeographies: async (_query, args, context, resolveInfo) => {
          const { pgClient, adminPool } = context;
          const { input: inputs } = args;

          // make sure all inputs share the same slug
          const slugs = new Set(inputs.map((input: any) => input.slug));
          if (slugs.size !== 1) {
            throw new Error("All inputs must have the same slug");
          }

          const createdGeographyIds = [] as number[];
          for (const input of inputs) {
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
                  templateId !== "DAYLIGHT_COASTLINE" ? name : "Land"
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
  const filterExpression = cql2ToFilterExpression(cql2Query);
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

export default GeographyPlugin;

function combineBBoxes(bboxes: number[][]) {
  if (bboxes.length === 0) {
    return undefined;
  }

  // Track if we're crossing the antimeridian
  let crossesAntimeridian = false;

  // Initialize with the first box
  const firstBox = bboxes[0];
  let minX = firstBox[0];
  let minY = firstBox[1];
  let maxX = firstBox[2];
  let maxY = firstBox[3];

  // Check each box to see if any individual box spans the antimeridian
  for (const box of bboxes) {
    if (box[0] > box[2]) {
      crossesAntimeridian = true;
      break;
    }
  }

  if (crossesAntimeridian) {
    // Handle antimeridian crossing by shifting coordinates
    // For each bbox, if it's in the eastern hemisphere (positive longitude),
    // shift it to be "east" of the western hemisphere by adding 360
    for (const box of bboxes) {
      // If a box spans the antimeridian itself
      if (box[0] > box[2]) {
        minX = Math.min(minX, box[0]);
        maxX = Math.max(maxX, box[2] + 360); // Shift the east side
      } else if (box[0] > 0) {
        // Box is in eastern hemisphere
        minX = Math.min(minX, box[0] - 360); // Shift to continue from western hemisphere
        maxX = Math.max(maxX, box[2]);
      } else {
        // Box is in western hemisphere
        minX = Math.min(minX, box[0]);
        maxX = Math.max(maxX, box[2]);
      }
      minY = Math.min(minY, box[1]);
      maxY = Math.max(maxY, box[3]);
    }
  } else {
    // Standard case - check if the combined boxes might cross the antimeridian
    let eastMost = -180;
    let westMost = 180;

    for (const box of bboxes) {
      minY = Math.min(minY, box[1]);
      maxY = Math.max(maxY, box[3]);

      eastMost = Math.max(eastMost, box[2]);
      westMost = Math.min(westMost, box[0]);
    }

    // If we have boxes on both sides of the meridian and they're far apart
    if (westMost < 0 && eastMost > 0 && eastMost - westMost > 180) {
      // We need to shift coordinates
      crossesAntimeridian = true;

      // Recalculate with shifting
      minX = 180;
      maxX = -180;

      for (const box of bboxes) {
        if (box[0] > 0) {
          // Eastern hemisphere
          minX = Math.min(minX, box[0] - 360);
          maxX = Math.max(maxX, box[2] - 360);
        } else {
          // Western hemisphere
          minX = Math.min(minX, box[0]);
          maxX = Math.max(maxX, box[2]);
        }
      }
    } else {
      // Standard case, no special handling needed
      minX = westMost;
      maxX = eastMost;
    }
  }

  return [minX, minY, maxX, maxY];
}

async function getBoundsForClippingLayer(
  url: string,
  object_key: string,
  cql2_query?: any,
  template_id?: string
) {
  // get the data source url for this clipping layer
  // get the data source url for this clipping layer
  if (template_id === "DAYLIGHT_COASTLINE") {
    return null;
  }
  if (!/tiles.seasketch.org/.test(url)) {
    throw new Error(
      `Data source URL ${url} is not supported for clipping layers`
    );
  }
  if (cql2_query === null) {
    // just grab the tilejson from the data server
    const response = await fetch(`${url}.json`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch tilejson from ${url}: ${response.statusText}`
      );
    }
    const tilejson = await response.json();
    if (!tilejson.bounds) {
      throw new Error(`TileJSON from ${url} does not contain bounds`);
    }
    return tilejson.bounds;
  } else {
    const queryString = new URLSearchParams({
      includeProperties: "_",
      bbox: "true",
      cql2JSONQuery: JSON.stringify(cql2_query),
      dataset: url.replace("https://tiles.seasketch.org/", "") + ".fgb",
      v: "5",
    }).toString();
    const overlayUrl = `https://overlay.seasketch.org/properties?${queryString}`;
    console.log("overlay url", overlayUrl);
    const response = await fetch(overlayUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch properties from overlay service: ${response.statusText}`
      );
    }
    const features = await response.json();
    if (!features.length) {
      throw new Error(
        `No features found for CQL2 query ${JSON.stringify(cql2_query)}`
      );
    }
    if (features.length > 1) {
      const boxes = features.map((f: any) => f.__bbox).filter(Boolean);
      return combineBBoxes(boxes);
    } else {
      return features[0].__bbox;
    }
  }
}
