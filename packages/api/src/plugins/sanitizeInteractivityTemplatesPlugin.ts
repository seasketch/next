import { SchemaBuilder } from "postgraphile";
import sanitizeHtml from "sanitize-html";

/**
 * This plugin sanitizes the `input.interactivitySettingsPatch.longTemplate/shortTemplate` fields
 */
export default function SanitizeInteractivityTemplatesPlugin(
  builder: SchemaBuilder
) {
  builder.hook("GraphQLObjectType:fields:field", (field, build, context) => {
    const {
      scope: { isPgUpdateMutationField, pgFieldIntrospection: table },
    } = context;
    if (
      !isPgUpdateMutationField ||
      table.kind !== "class" ||
      table.name !== "interactivity_settings"
    ) {
      return field;
    }

    const oldResolve = field.resolve;

    return {
      ...field,
      resolve(_mutation, args, context, info) {
        // Sanitize fields
        if (args.input.patch.shortTemplate) {
          args.input.patch.shortTemplate = sanitizeInput(
            args.input.patch.shortTemplate
          );
        }
        if (args.input.patch.longTemplate) {
          args.input.patch.longTemplate = sanitizeInput(
            args.input.patch.longTemplate
          );
        }
        return oldResolve!(_mutation, args, context, info);
      },
    };
  });
}

function sanitizeInput(input: string) {
  input = input.replace(/\{\{\{/g, "{{");
  input = input.replace(/\{\{\&/g, "{{");
  input = input.replace(/\}\}\}/g, "}}");
  input = sanitizeHtml(input, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style", "class"],
    },
  });
  return input;
}
