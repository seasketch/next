import {
  makeAddPgTableConditionPlugin,
  makeAddPgTableOrderByPlugin,
  makePluginByCombiningPlugins,
} from "graphile-utils";
import { GraphQLBoolean } from "graphql";

/**
 * Adds what the admin "Changelog" view needs to page through a project's full
 * history using the standard Relay connection on `Project.changeLogsConnection`
 * (first / after / pageInfo), without any offset scanning.
 *
 * - `LAST_AT_DESC` / `LAST_AT_ASC` order by (last_at, id). Including `id` makes
 *   the ordering unique so keyset cursors are stable when entries share a
 *   timestamp. `change_logs_project_lastat_idx` (project_id, net_zero_changes,
 *   last_at DESC) serves the project filter, the net-zero condition and the
 *   primary sort, so a page is a short index range scan.
 * - `condition: { netZeroChanges: false }` hides entries whose from/to values
 *   cancel each other out, consistent with every other changelog listing.
 */
const ChangeLogsOrderByPlugin = makeAddPgTableOrderByPlugin(
  "public",
  "change_logs",
  () => ({
    LAST_AT_DESC: {
      value: {
        specs: [
          ["last_at", false],
          ["id", false],
        ],
        unique: true,
      },
    },
    LAST_AT_ASC: {
      value: {
        specs: [
          ["last_at", true],
          ["id", true],
        ],
        unique: true,
      },
    },
  })
);

const ChangeLogsNetZeroConditionPlugin = makeAddPgTableConditionPlugin(
  "public",
  "change_logs",
  "netZeroChanges",
  () => ({
    description:
      "Filters on the `net_zero_changes` flag. Pass `false` to exclude changes that were reverted to their original value.",
    type: GraphQLBoolean,
  }),
  (value, { sql, sqlTableAlias }) =>
    typeof value === "boolean"
      ? sql.fragment`${sqlTableAlias}.net_zero_changes = ${sql.value(value)}`
      : null
);

export default makePluginByCombiningPlugins(
  ChangeLogsOrderByPlugin,
  ChangeLogsNetZeroConditionPlugin
);
