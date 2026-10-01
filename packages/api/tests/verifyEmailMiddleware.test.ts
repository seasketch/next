import { IncomingRequest } from "../src/middleware/IncomingRequest";
import middleware from "../src/middleware/verifyEmailMiddleware";
import auth0 from "auth0";
import { resetManagementClientForTests } from "../src/auth/auth0";

jest.mock("auth0");
// @ts-ignore
auth0.ManagementClient.prototype.updateUser = jest.fn(() => {});

const ENV_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
] as const;

const original: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> =
  {};

beforeAll(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
  }
});

beforeEach(() => {
  process.env.AUTH0_DOMAIN = "example.auth0.com";
  process.env.AUTH0_CLIENT_ID = "client-id";
  process.env.AUTH0_CLIENT_SECRET = "client-secret";
  resetManagementClientForTests();
  // @ts-ignore
  auth0.ManagementClient.prototype.updateUser.mockReset();
  // @ts-ignore
  auth0.ManagementClient.prototype.updateUser.mockImplementation(() => {});
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

test("email is set as verified in the auth0 api if survey invite email matches", (done) => {
  const req = {
    user: {
      id: 2,
      sub: "google:2",
      canonicalEmail: "chad@example.com",
      "https://seasketch.org/email_verified": false,
    },
    surveyInvite: {
      email: "chad@example.com",
    },
  } as IncomingRequest;
  // @ts-ignore
  middleware(req, {}, () => {
    expect(req.user?.emailVerified).toBe(true);
    expect(auth0.ManagementClient.prototype.updateUser).toBeCalledTimes(1);
    done();
  });
});

test("auth0 management api not called if email is already verified", (done) => {
  const req = {
    user: {
      id: 2,
      sub: "google:2",
      canonicalEmail: "chad@example.com",
      "https://seasketch.org/email_verified": true,
    },
    surveyInvite: {
      email: "chad@example.com",
    },
  } as IncomingRequest;
  // @ts-ignore
  middleware(req, {}, () => {
    expect(req.user?.emailVerified).toBe(true);
    expect(auth0.ManagementClient.prototype.updateUser).toBeCalledTimes(0);
    done();
  });
});

test("auth0 management api not called if email doesn't match", (done) => {
  const req = {
    user: {
      id: 2,
      sub: "google:2",
      canonicalEmail: "chad@example.com",
      "https://seasketch.org/email_verified": false,
    },
    surveyInvite: {
      email: "chad+foo@example.com",
    },
  } as IncomingRequest;
  // @ts-ignore
  middleware(req, {}, () => {
    expect(req.user?.emailVerified).toBe(false);
    expect(auth0.ManagementClient.prototype.updateUser).toBeCalledTimes(0);
    done();
  });
});

test("continues without verifying when Auth0 management is unconfigured", (done) => {
  delete process.env.AUTH0_DOMAIN;
  delete process.env.AUTH0_CLIENT_ID;
  delete process.env.AUTH0_CLIENT_SECRET;
  resetManagementClientForTests();

  const req = {
    user: {
      id: 2,
      sub: "google:2",
      canonicalEmail: "chad@example.com",
      "https://seasketch.org/email_verified": false,
    },
    surveyInvite: {
      email: "chad@example.com",
    },
  } as IncomingRequest;
  // @ts-ignore
  middleware(req, {}, () => {
    expect(req.user?.emailVerified).toBe(false);
    expect(auth0.ManagementClient.prototype.updateUser).toBeCalledTimes(0);
    done();
  });
});
