/**
 * Thrown when production calls a feature whose required configuration is missing.
 * Non-production leaves the feature unavailable instead of throwing.
 */
export class MisconfiguredError extends Error {
  readonly missing: string[];

  constructor(feature: string, missing: string[]) {
    const listed = missing.join(", ");
    const verb = missing.length === 1 ? "is" : "are";
    super(`${feature} is misconfigured: ${listed} ${verb} not set`);
    this.name = "MisconfiguredError";
    this.missing = missing;
  }
}

/**
 * In production, a missing setting is a failed call. Elsewhere, returns so the
 * caller can disable the feature and keep booting.
 */
export function throwIfProductionMisconfigured(
  feature: string,
  missing: string[],
): void {
  if (process.env.NODE_ENV !== "production") return;
  if (missing.length === 0) return;
  throw new MisconfiguredError(feature, missing);
}

/**
 * Helper function to safely access required environment variables
 * This provides better type safety than direct process.env access
 */
export function getRequiredEnvVar(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Helper function to access optional environment variables
 */
export function getOptionalEnvVar(
  name: keyof NodeJS.ProcessEnv
): string | undefined {
  return process.env[name];
}
