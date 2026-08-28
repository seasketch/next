import { readFileSync } from "fs";
import { join } from "path";

export function loadFixture(name: string): unknown {
  const raw = readFileSync(join(__dirname, "fixtures", name), "utf8");
  return JSON.parse(raw);
}

export function loadCkanResult(name: string): unknown {
  const data = loadFixture(name) as { result?: unknown };
  return data.result ?? data;
}
