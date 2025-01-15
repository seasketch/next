import { makeExtendSchemaPlugin, gql } from "graphile-utils";
import { DOMSerializer, Fragment, Node } from "prosemirror-model";
import { JSDOM } from "jsdom";
import { aboutPageSchema } from "../prosemirror/config";

const AboutPagePlugin = makeExtendSchemaPlugin((build) => {
  return {
    typeDefs: gql`
      type RenderedAboutPageContent {
        lang: String
        html: String
      }

      extend type Project {
        """
        Metadata will be returned as directly stored in the SeaSketch
        database or computed by fetching from a 3rd party service,
        depending on the data source type.
        """
        aboutPageRenderedContent: [RenderedAboutPageContent]
          @requires(columns: ["aboutPageContents", "aboutPageEnabled"])
      }
    `,
    resolvers: {
      Project: {
        aboutPageRenderedContent: async (project, args, context, info) => {
          if (project.aboutPageEnabled && project.aboutPageContents) {
            // Assuming project.aboutPageContents is an object with language keys
            return Object.entries(project.aboutPageContents).map(
              ([lang, content]) => {
                try {
                  const dom = new JSDOM(
                    `<!DOCTYPE html><body><div id="target"></div></body></html>`
                  );
                  const target = dom.window.document.getElementById("target")!;
                  const options = { document: dom.window.document };
                  let contentNode = Node.fromJSON(aboutPageSchema, content);
                  DOMSerializer.fromSchema(aboutPageSchema).serializeFragment(
                    contentNode.content,
                    options,
                    target
                  );
                  return {
                    lang,
                    html: target.innerHTML,
                  };
                } catch (e) {
                  return {
                    lang,
                    html: `<code>${(e as Error).message}</code>`,
                  };
                }
              }
            );
          } else {
            return [];
          }
        },
      },
    },
  };
});

export default AboutPagePlugin;
