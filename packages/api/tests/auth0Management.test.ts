import {
  AUTH0_MANAGEMENT_NOT_CONFIGURED,
  getCanonicalEmails,
  getManagementClient,
  resetManagementClientForTests,
  verifyEmail,
} from "../src/auth/auth0";

const ENV_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
] as const;

/**
 * Jest runs each test file in a worker process. Workers do not share
 * process.env with each other, but files assigned to the same worker run
 * sequentially and do share process.env and the auth0 module cache. Always
 * restore both so a later file in this worker is not affected.
 */
describe("Auth0 management client", () => {
  const original: Partial<
    Record<(typeof ENV_KEYS)[number], string | undefined>
  > = {};

  beforeAll(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
    resetManagementClientForTests();
  });

  test("getManagementClient returns null when Auth0 env is unset", () => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    resetManagementClientForTests();

    expect(getManagementClient()).toBeNull();
  });

  test("getManagementClient returns null when only some Auth0 env vars are set", () => {
    process.env.AUTH0_DOMAIN = "example.auth0.com";
    delete process.env.AUTH0_CLIENT_ID;
    process.env.AUTH0_CLIENT_SECRET = "secret";
    resetManagementClientForTests();

    expect(getManagementClient()).toBeNull();
  });

  test("getManagementClient constructs a client when Auth0 env is set", () => {
    process.env.AUTH0_DOMAIN = "example.auth0.com";
    process.env.AUTH0_CLIENT_ID = "client-id";
    process.env.AUTH0_CLIENT_SECRET = "client-secret";
    resetManagementClientForTests();

    const client = getManagementClient();
    expect(client).not.toBeNull();
    // Same instance on subsequent calls
    expect(getManagementClient()).toBe(client);
  });

  test("management helpers throw a clear error when Auth0 is unconfigured", async () => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    resetManagementClientForTests();

    await expect(getCanonicalEmails(["auth0|1"])).rejects.toThrow(
      AUTH0_MANAGEMENT_NOT_CONFIGURED
    );
    await expect(verifyEmail("auth0|1")).rejects.toThrow(
      AUTH0_MANAGEMENT_NOT_CONFIGURED
    );
  });

  test("module import does not require Auth0 env", () => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    resetManagementClientForTests();
    // Requiring again should not throw even with Auth0 unset
    expect(() => require("../src/auth/auth0")).not.toThrow();
  });
});
