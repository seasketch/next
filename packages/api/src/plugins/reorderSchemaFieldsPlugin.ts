import { makeProcessSchemaPlugin } from "graphile-utils";

type FieldOrderConfig = {
  [typeName: string]: string[];
};

export default function reorderSchemaFieldsPlugin(
  fieldOrderConfig: FieldOrderConfig
) {
  return makeProcessSchemaPlugin((schema) => {
    // @ts-ignore
    const typeMap = schema.getTypeMap() as Map;
    // @ts-ignore
    console.log(fieldOrderConfig, fieldOrderConfig.Mutation._fields);
    for (const typeName in fieldOrderConfig) {
      const fieldMap = typeMap[typeName]._fields;
      const map = new Map();
      const fieldOrder = fieldOrderConfig[typeName];
      for (const fieldName of fieldOrder) {
        const val = fieldMap[fieldName];
        if (!val) {
          throw new Error(`Unknown field ${typeName}.${fieldName}`);
        } else {
          // @ts-ignore
          map[fieldName] = val;
        }
      }
      for (const fieldName of Object.keys(fieldMap)) {
        if (fieldOrder.indexOf(fieldName) === -1) {
          // @ts-ignore
          map[fieldName] = fieldMap[fieldName];
        }
      }
      typeMap[typeName]._fields = map;
    }
    return schema;
  });
}
