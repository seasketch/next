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
