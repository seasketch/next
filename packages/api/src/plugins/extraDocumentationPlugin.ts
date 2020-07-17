import { makeProcessSchemaPlugin } from "graphile-utils";

type ExtraDocumentationConfig = {
  [typeName: string]: string;
};

export default function reorderSchemaFieldsPlugin(
  config: ExtraDocumentationConfig
) {
  return makeProcessSchemaPlugin((schema) => {
    for (const typeName in config) {
      const type = schema.getType(typeName.split(".")[0]);
      if (!type) {
        throw new Error(`Could not find type "${typeName}" in schema`);
      }
      if (/\./.test(typeName)) {
        // is a comment on a type's field
        // @ts-ignore
        const field = type._values
          ? // @ts-ignore
            type._values.find((v) => v.name === typeName.split(".")[1])
          : // @ts-ignore
            type.getFields()[typeName.split(".")[1]];
        if (!field) {
          throw new Error(`Could not find field "${typeName}"`);
        } else {
          field.description = config[typeName];
        }
      } else {
        type.description = config[typeName];
      }
    }
    return schema;
  });
}
