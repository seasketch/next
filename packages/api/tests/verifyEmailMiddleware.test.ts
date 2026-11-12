import { IncomingRequest } from "../src/middleware/IncomingRequest";
import middleware from "../src/middleware/verifyEmailMiddleware";

test("a verified claim marks the session email as verified", (done) => {
  const req = {
    user: {
      id: 2,
      sub: "google:2",
      canonicalEmail: "chad@example.com",
      "https://seasketch.org/email_verified": true,
    },
  } as IncomingRequest;
  middleware(req, {} as any, () => {
    expect(req.user?.emailVerified).toBe(true);
    done();
  });
});

test("an unverified claim leaves the session email unverified", (done) => {
  const req = {
    user: {
      id: 2,
      sub: "google:2",
      canonicalEmail: "chad@example.com",
      "https://seasketch.org/email_verified": false,
    },
  } as IncomingRequest;
  middleware(req, {} as any, () => {
    expect(req.user?.emailVerified).toBe(false);
    done();
  });
});

test("requests without a user continue", (done) => {
  const req = {} as IncomingRequest;
  middleware(req, {} as any, () => {
    expect(req.user).toBeUndefined();
    done();
  });
});
