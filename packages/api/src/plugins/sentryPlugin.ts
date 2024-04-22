import { PostGraphilePlugin } from "postgraphile";
import * as Sentry from "@sentry/node";
import { print as printGraphql } from "graphql";

const SentryPlugin: PostGraphilePlugin = {
  ["postgraphile:http:result"](result, { queryDocumentAst, pgRole, req }) {
    /*
     * Originally taken from PostGraphile's internal implementation:
     * https://github.com/graphile/postgraphile/blob/1719cbfef041e59536482ed20551d593fb82f78e/src/postgraphile/http/createPostGraphileHttpRequestHandler.ts#L748-L776
     * Augmented to use consola.
     */

    if (queryDocumentAst) {
      // We must reference this before it's deleted!
      const resultStatusCode = result.statusCode;
      // We setImmediate so that performing the log does not interfere with
      // returning the result to the user (reduces latency).
      setImmediate(() => {
        const operations = queryDocumentAst.definitions.filter(
          (d: any) => d.operation === "query" || d.operation === "mutation"
        );
        const errorCount = (result.errors || []).length;
        if (operations.length) {
          const graphqlDetails = {
            operationType: operations[0].operation,
            name: operations[0].name?.value || "Un-named operation",
            role: pgRole,
            errorCount,
            resultStatusCode: resultStatusCode || 200,
            // Pretty-printing this query is not cheap; it's probably smart not to do
            // this in production if performance is critical to you.
            prettyQuery:
              errorCount > 0
                ? printGraphql(queryDocumentAst).replace(/\s+/g, " ").trim()
                : undefined,
          };
          Sentry.configureScope((scope) =>
            scope.setTransactionName(
              `${graphqlDetails.operationType.toUpperCase()} ${
                graphqlDetails.name
              }`
            )
          );
          Sentry.setContext("graphql", graphqlDetails);

          if (result.errors && result.errors.length > 0) {
            for (const err of result.errors as {
              message: string;
              path?: string[];
              location?: string;
            }[]) {
              Sentry.withScope((scope) => {
                // Annotate whether failing operation was query/mutation/subscription
                scope.setTag("kind", graphqlDetails.operationType);
                scope.setExtra("query", graphqlDetails.name);

                if (err.path) {
                  // We can also add the path as breadcrumb
                  scope.addBreadcrumb({
                    category: "query-path",
                    message: err.path.join(" > "),
                    level: "debug",
                  });
                }
                Sentry.captureException(
                  new Error(err.message || "Unknown GraphqlError")
                );
              });
            }
          }
        }
      });
    }
    return result;
  },
};

export default SentryPlugin;
