/**
 * Deterministic Tailwind CLI wrapper.
 *
 * Home and work machines previously disagreed on src/index.css because:
 * - `npx tailwindcss` can resolve a different CLI than the locked 3.4.17
 * - Autoprefixer follows browserslist, which changes with NODE_ENV and
 *   whatever caniuse-lite happens to be in node_modules after an update
 * - A developer-local BROWSERSLIST / cache can override package.json
 */
const { spawnSync } = require("child_process");
const path = require("path");

process.env.BROWSERSLIST = ">0.2%, not dead, not op_mini all";
process.env.BROWSERSLIST_ENV = "production";
process.env.BROWSERSLIST_IGNORE_OLD_DATA = "1";
process.env.BROWSERSLIST_DISABLE_CACHE = "1";

const cli = require.resolve("tailwindcss/lib/cli.js");
const result = spawnSync(
  process.execPath,
  [
    cli,
    "-i",
    path.join("src", "tailwind.css"),
    "-o",
    path.join("src", "index.css"),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" }
);

process.exit(result.status === null ? 1 : result.status);
