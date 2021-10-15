import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { createApi } from "unsplash-js";
const nodeFetch = require("node-fetch");

const unsplash = createApi({
  accessKey: process.env.UNSPLASH_KEY!,
  // @ts-ignore
  fetch: nodeFetch,
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
    `,
    resolvers: {
      Query: {
        getUnsplashPhotos: async (_query, args, context, resolveInfo) => {
          console.log(args);
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
    },
  };
});

export default UnsplashPlugin;
