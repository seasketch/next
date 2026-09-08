import { existsSync, readFileSync, statSync } from "fs";
import { spawn } from "child_process";
import { resolve } from "path";
import { CrwProduct, r2Key } from "./products";

export type R2Env = {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket: string;
};

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value.startsWith("op://")) continue;
    out[key] = value;
  }
  return out;
}

export function loadR2Env(envFile?: string): R2Env {
  const fromFile = envFile ? parseEnvFile(envFile) : {};
  const apiEnv = parseEnvFile(resolve(__dirname, "../../api/.env"));
  const merged = { ...apiEnv, ...fromFile, ...process.env };
  return {
    endpoint: merged.R2_ENDPOINT,
    accessKeyId: merged.R2_ACCESS_KEY_ID,
    secretAccessKey: merged.R2_SECRET_ACCESS_KEY,
    bucket: merged.R2_TILES_BUCKET || "ssn-tiles",
  };
}

function run(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      env: env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (buf) => {
      stdout += buf.toString();
    });
    child.stderr?.on("data", (buf) => {
      stderr += buf.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`${command} ${args.join(" ")}\n${stderr || stdout}`));
    });
  });
}

async function objectExistsAws(env: R2Env, key: string): Promise<boolean> {
  if (!env.endpoint || !env.accessKeyId || !env.secretAccessKey) return false;
  try {
    await run(
      "aws",
      [
        "s3api",
        "head-object",
        "--bucket",
        env.bucket,
        "--key",
        key,
        "--endpoint-url",
        env.endpoint,
      ],
      {
        ...process.env,
        AWS_ACCESS_KEY_ID: env.accessKeyId,
        AWS_SECRET_ACCESS_KEY: env.secretAccessKey,
        AWS_DEFAULT_REGION: "auto",
      },
    );
    return true;
  } catch {
    return false;
  }
}

async function uploadAws(env: R2Env, localPath: string, key: string): Promise<void> {
  if (!env.endpoint || !env.accessKeyId || !env.secretAccessKey) {
    throw new Error("R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are required for aws upload");
  }
  await run(
    "aws",
    [
      "s3",
      "cp",
      localPath,
      `s3://${env.bucket}/${key}`,
      "--endpoint-url",
      env.endpoint,
      "--content-type",
      "application/vnd.pmtiles",
    ],
    {
      ...process.env,
      AWS_ACCESS_KEY_ID: env.accessKeyId,
      AWS_SECRET_ACCESS_KEY: env.secretAccessKey,
      AWS_DEFAULT_REGION: "auto",
    },
  );
}

async function uploadWrangler(localPath: string, key: string): Promise<void> {
  const wranglerToml = resolve(__dirname, "../../pmtiles-server/wrangler.toml");
  await run("npx", [
    "wrangler",
    "r2",
    "object",
    "put",
    `ssn-tiles/${key}`,
    "--file",
    localPath,
    "--remote",
    "--content-type",
    "application/vnd.pmtiles",
    "--config",
    wranglerToml,
  ]);
}

export async function uploadProductArchive(
  product: CrwProduct,
  localPath: string,
  options: { force?: boolean; envFile?: string } = {},
): Promise<{ key: string; bytes: number; method: string }> {
  if (!existsSync(localPath)) {
    throw new Error(`Archive not found: ${localPath}`);
  }
  const key = r2Key(product);
  const bytes = statSync(localPath).size;
  const env = loadR2Env(options.envFile);
  const hasAws = Boolean(env.endpoint && env.accessKeyId && env.secretAccessKey);

  if (hasAws) {
    const exists = await objectExistsAws(env, key);
    if (exists && !options.force) {
      throw new Error(
        `R2 object already exists: ${key}. Pass --force to overwrite.`,
      );
    }
    await uploadAws(env, localPath, key);
    return { key, bytes, method: "aws s3 cp" };
  }

  if (!options.force) {
    console.error(
      "No R2 AWS credentials; uploading with wrangler. Pass --force if the key already exists.",
    );
  }
  await uploadWrangler(localPath, key);
  return { key, bytes, method: "wrangler r2 object put" };
}
