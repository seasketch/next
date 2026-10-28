export function uploadsBaseUrl(): string {
  const value = process.env.UPLOADS_BASE_URL;
  if (!value) {
    throw new Error("UPLOADS_BASE_URL must be set");
  }
  return value.replace(/\/$/, "");
}

export function tilesBaseUrl(): string {
  const value = process.env.TILES_BASE_URL;
  if (!value) {
    throw new Error("TILES_BASE_URL must be set");
  }
  return value.replace(/\/$/, "");
}

/** Public URL for an r2:// or s3:// remote, using the uploads origin from the environment. */
export function publicUrlForRemote(remote: string): string {
  const key = remote.replace(/^(?:r2|s3):\/\/[^/]+\//, "");
  if (!key || key === remote) {
    throw new Error(`Cannot derive an object key from remote ${remote}`);
  }
  return `${uploadsBaseUrl()}/${key}`;
}

/** Origin plus path with the last segment replaced. parquet URLs stay on their own host. */
export function replaceUrlFileName(url: string, fileName: string): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split("/");
  parts[parts.length - 1] = fileName;
  parsed.pathname = parts.join("/");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}
