import { IncomingRequest } from "../src/middleware/IncomingRequest";
import middleware from "../src/middleware/verifyEmailMiddleware";
import auth0 from "auth0";
jest.mock("auth0");
// @ts-ignore
auth0.ManagementClient.prototype.updateUser = jest.fn(() => {});

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
  // @ts-ignore
  auth0.ManagementClient.prototype.updateUser.mockReset();
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
  // @ts-ignore
  auth0.ManagementClient.prototype.updateUser.mockReset();
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
