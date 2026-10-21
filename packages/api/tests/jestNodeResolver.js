const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const shimDir = path.join(os.tmpdir(), "seasketch-jest-node-shims");
const builtins = new Set(Module.builtinModules);

// Jest 26's resolver treats `node:stream` as a relative file. Rewrite those
// specifiers to a shim that loads the built-in, which is what Node does.
module.exports = (request, options) => {
  const name = request.startsWith("node:") ? request.slice("node:".length) : null;
  if (name && builtins.has(name)) {
    fs.mkdirSync(shimDir, { recursive: true });
    const file = path.join(shimDir, `${name.replace(/[\\/]/g, "__")}.js`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        `module.exports = require(${JSON.stringify(name)});\n`
      );
    }
    return file;
  }
  return options.defaultResolver(request, options);
};
