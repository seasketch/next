import { DBClient } from "./dbClient";
import { normalizeSpatialProperties } from "./ExportUtils";
import { createExportId } from "./plugins/exportIdPlugin";

export async function getFeatureCollection(
  surveyId: number,
  formElementId: number,
  client: DBClient
) {
  const results = await client.query(`select export_spatial_responses($1)`, [
    formElementId,
  ]);
  const collection = results.rows[0].export_spatial_responses;
  const { rows } = await client.query(
    `
    select
      type_id as "typeId",
      component_settings as "componentSettings",
      export_id as "exportId",
      position,
      id,
      form_element_types.is_input as "isInput",
      body
    from
      form_elements
    inner join
      form_element_types
    on
      form_element_types.component_name = form_elements.type_id
    where
      form_elements.form_id = (
        select id from forms where sketch_class_id = (
          select id from sketch_classes where form_element_id = $1
        )
      );
  `,
    [formElementId]
  );
  const formElements = rows;
  for (const element of formElements) {
    element.exportId = createExportId(
      element.id,
      element.body,
      element.exportId
    );
  }
  if (!collection || !collection.features || !collection.features.length) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  } else {
    return normalizeSpatialProperties(surveyId, collection, formElements);
  }
}
