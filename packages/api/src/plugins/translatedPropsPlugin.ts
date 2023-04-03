import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import format from "pg-format";
import snakeCase from "lodash.snakecase";
import pluralize from "pluralize";

/**
 * translatedProps is a pattern for translating admin managed content like
 * project and data layer names and discussion forum titles. Since there are
 * many record types that need to implement this pattern, common React
 * components and graphql mutations are used to manage this information.
 *
 * To add support for a new object type, perform the following steps:
 * 1. Add the translated_props column to the table using a new migration like so
 *    ```sql
 *       alter table projects add column if not exists translated_props jsonb not null default '{}'::jsonb;
 *       grant select(translated_props) on projects to anon;
 *    ```
 * 2. Use components/TranslatedPropControl.tsx in the admin interface to edit
 *    translations and the related getTranslatableProp() function to display it.
 */
const TranslatedPropsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      input TranslatedPropInput {
        languageCode: String!
        value: String
      }
      type setTranslatedPropResult {
        typeName: String!
        id: Int!
        translatedProps: JSON!
      }

      extend type Mutation {
        """
        """
        setTranslatedProp(
          id: Int!
          typeName: String!
          propName: String!
          translations: [TranslatedPropInput!]!
        ): setTranslatedPropResult!
      }
    `,
    resolvers: {
      Mutation: {
        setTranslatedProp: async (_query, args, context, resolveInfo) => {
          const { id, typeName, propName, translations } = args;
          // For each argument above, throw an error if it is missing
          if (!id) {
            throw new Error("Missing id");
          }
          if (!typeName) {
            throw new Error("Missing typeName");
          }
          if (!propName) {
            throw new Error("Missing propName");
          }
          if (!translations) {
            throw new Error("Missing translations");
          }
          // retrieve current translated props
          if (!Array.isArray(translations)) {
            throw new Error(
              "translations must be an array of TranslatedPropInput"
            );
          }
          if (translations.length === 0) {
            throw new Error("translations must not be empty");
          }
          const { pgClient } = context;

          const tableName = snakeCase(pluralize(typeName));
          const translationObject: { [languageCode: string]: string | null } =
            {};
          for (const translation of translations) {
            if (!translation.languageCode) {
              throw new Error("Missing languageCode");
            }
            if (!translation.value || translation.value.length === 0) {
              translationObject[translation.languageCode] = null;
            } else {
              translationObject[translation.languageCode] = translation.value;
            }
          }

          const { rows } = await pgClient.query(
            `
            update ${format.ident(
              tableName
            )} set translated_props = merge_translated_props(translated_props, $1, $2::jsonb) where id = $3 returning id, translated_props
          `,
            [propName, JSON.stringify(translationObject), id]
          );
          return {
            typeName,
            id: rows[0].id,
            translatedProps: rows[0].translated_props,
          };
        },
      },
    },
  };
});

export default TranslatedPropsPlugin;
