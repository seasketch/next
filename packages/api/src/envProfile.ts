import fs from "fs";
import path from "path";
import { createRequire } from "module";

function envProfileModulePath(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "env-manifest.json"))) {
      return path.join(dir, "envProfile.js");
    }
    dir = path.dirname(dir);
  }
  throw new Error("env-manifest.json not found");
}

const nodeRequire = createRequire(__filename);

export function assertNonProductionProfile(): void {
  nodeRequire(envProfileModulePath()).assertNonProductionProfile();
}
