import { postgraphile } from "postgraphile";
import { makeExtendSchemaPlugin, gql } from "graphile-utils";
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
 * 2. Add the schema type to the union definition below
 * 3. Update mutation setTranslatedProps in ProjectAccessControlSettings.graphql
 *    so that it returns the common props for that object type
 * 4. Use components/TranslatedPropControl.tsx in the admin interface to edit
 *    translations and the related getTranslatableProp() function to display it.
 */
const TranslatedPropsPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      union Translatable = Project | TableOfContentsItem
      input TranslatedPropInput {
        languageCode: String!
        value: String
      }
      extend type Mutation {
        """
        """
        setTranslatedProp(
          id: Int!
          typeName: String!
          propName: String!
          translations: [TranslatedPropInput!]!
        ): Translatable!
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
          console.log(sql.identifier(typeName));

          const { rows } = await pgClient.query(
            `
            select translated_props from $1 where id = $2
          `,
            [typeName, id]
          );
          console.log(rows);
          const translatedProps = rows[0].translated_props || {};

          console.log("translatedProps", translatedProps);
          // Update translated props with new values
          for (const translationInput of translations) {
            const { languageCode, value } = translationInput;
            if (!value || value.length === 0) {
              // If the value is empty, delete the property
              delete translatedProps[languageCode][propName];
            } else {
              translatedProps[languageCode] = {
                ...translatedProps[languageCode],
                [propName]: value,
              };
            }
          }

          // Update translated props in the database, and return the updated object
          const updateResult = await pgClient.query(
            `
            update $1 set translated_props = $2 where id = $3 returning *
          `,
            [typeName, translatedProps, id]
          );
          return updateResult.rows[0];
        },
      },
    },
  };
});

export default TranslatedPropsPlugin;
