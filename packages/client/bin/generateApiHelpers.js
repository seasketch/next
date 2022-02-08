const esbuild = require("esbuild");
const ignorePlugin = require("esbuild-plugin-ignore");
const alias = require("esbuild-plugin-alias");
const fs = require("fs");
const path = require("path");

(async () => {
  const opt = {
    entryPoints: ["src/formElements/ExportUtils.ts"],
    bundle: true,
    outfile: "out.js",
    platform: "node",
    external: ["node_modules/*", "*.mp4", "comlink*"],
  };
  await esbuild.build({ ...opt, outfile: "out.js" });
})();

// esbuild.buildSync({
//   entryPoints: ["src/formElements/ExportUtils.ts"],
//   bundle: true,
//   outfile: "out.js",
//   platform: "node",
//   external: ["node_modules/*", "*.mp4", "comlink*"],
//   plugins: [
//     ignorePlugin([
//       {
//         resourceRegExp: /comlink$/,
//         // contextRegExp: /node_modules\/sequelize|node_modules\/pg/
//       },
//       // {
//       //   resourceRegExp: /tedious|sqlite3|mariadb$/,
//       //   // contextRegExp: /node_modules\/sequelize/
//       // },
//     ]),
//   ],
// });
