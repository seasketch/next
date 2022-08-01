import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { createApi } from "unsplash-js";

const unsplash = createApi({
  accessKey: process.env.UNSPLASH_KEY!,
  // @ts-ignore
  fetch,
});

const UnsplashPlugin = makeExtendSchemaPlugin((build) => {
  const { pgSql: sql } = build;
  return {
    typeDefs: gql`
      type UnsplashLinks {
        html: String!
      }

      type UnsplashUrls {
        raw: String!
        full: String!
        regular: String!
        small: String!
        thumb: String!
      }

      type UnsplashUser {
        id: String!
        username: String!
        name: String!
        links: UnsplashLinks!
      }

      type UnsplashPhotoLinks {
        download_location: String!
      }

      type UnsplashPhoto {
        id: String!
        width: Int!
        height: Int!
        color: String!
        blur_hash: String
        description: String
        user: UnsplashUser!
        urls: UnsplashUrls!
        links: UnsplashPhotoLinks!
      }

      type UnsplashSearchResult {
        total: Int!
        total_pages: Int!
        results: [UnsplashPhoto!]!
      }

      extend type Query {
        getUnsplashPhotos(query: String!): UnsplashSearchResult!
      }

      extend type Mutation {
        setFormElementBackground(
          id: Int!
          backgroundUrl: String!
          downloadUrl: String!
          backgroundColor: String!
          backgroundPalette: [String]!
          unsplashAuthorName: String!
          unsplashAuthorUrl: String!
          secondaryColor: String!
          backgroundWidth: Int!
          backgroundHeight: Int!
        ): FormElement!
      }
    `,
    resolvers: {
      Query: {
        getUnsplashPhotos: async (_query, args, context, resolveInfo) => {
          const results = await unsplash.search.getPhotos({
            query: args.query,
            perPage: 50,
          });
          if (results.errors) {
            throw results.errors;
          } else {
            return results.response;
          }
        },
      },
      Mutation: {
        setFormElementBackground: async (
          _query,
          args,
          context,
          resolveInfo
        ) => {
          const { pgClient } = context;
          // Start a sub-transaction
          await pgClient.query("SAVEPOINT graphql_mutation");
          try {
            await unsplash.photos.trackDownload({
              downloadLocation: args.downloadUrl,
            });
            const {
              rows: [formElement],
            } = await pgClient.query(
              `update public.form_elements set background_color = $1, secondary_color = $2, background_image = $3, background_palette = $4, unsplash_author_name = $5, unsplash_author_url = $6, background_width = $7, background_height = $8 where id = $9 RETURNING *`,
              [
                args.backgroundColor,
                args.secondaryColor,
                args.backgroundUrl,
                args.backgroundPalette,
                args.unsplashAuthorName,
                args.unsplashAuthorUrl,
                args.backgroundWidth,
                args.backgroundHeight,
                args.id,
              ]
            );
            const [row] =
              await resolveInfo.graphile.selectGraphQLResultFromTable(
                sql.fragment`public.form_elements`,
                (tableAlias, queryBuilder) => {
                  queryBuilder.where(
                    sql.fragment`${tableAlias}.id = ${sql.value(args.id)}`
                  );
                }
              );
            return row;
          } catch (e) {
            // Oh noes! If at first you don't succeed,
            // destroy all evidence you ever tried.
            await pgClient.query("ROLLBACK TO SAVEPOINT graphql_mutation");
            throw e;
          } finally {
            // Release our savepoint so it doesn't conflict with other mutations
            await pgClient.query("RELEASE SAVEPOINT graphql_mutation");
          }
        },
      },
    },
  };
});

export default UnsplashPlugin;
