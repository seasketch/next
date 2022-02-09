// esbuild --banner:js=\"// @ts-nocheck\" --platform=node --external:@apollo/client --external:node_modules/* --external:*.mp4 --external:comlink* --outfile=../api/src/ExportUtils.js --bundle src/formElements/ExportUtils.ts && cp src/formElements/ExportUtils.d.ts ../api/src/
const path = require("path");
const alias = require("esbuild-plugin-alias");

require("esbuild")
  .build({
    entryPoints: ["src/formElements/ExportUtils.ts"],
    bundle: true,
    outfile: "../api/src/ExportUtils.js",
    banner: {
      js: `// @ts-nocheck`,
    },
    platform: "neutral",
    external: ["node_modules/*", "*.mp4", "comlink*", "@apollo/client"],
    plugins: [
      alias({
        "@apollo/client": path.join(
          __dirname,
          "../../api/node_modules/graphql-tag/main.js"
        ),
      }),
    ],
  })
  .catch(() => process.exit(1));
