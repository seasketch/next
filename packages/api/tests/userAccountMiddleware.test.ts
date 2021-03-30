import { IncomingRequest } from "../src/middleware/IncomingRequest";
import middleware from "../src/middleware/userAccountMiddleware";
import getPool from "../src/pool";
import { Pool } from "pg";

let pool: Pool;
getPool().then((p) => (pool = p));

test("anonymous user, no req.user assigned", (done) => {
  const req = {} as IncomingRequest;
  // @ts-ignore
  middleware(req, {}, () => {
    expect(req.user).toBeUndefined();
    done();
  });
});

test("user id retrieved using sub", (done) => {
  //@ts-ignore
  pool.add("select get_or_create_user_by_sub($1)", ["string"], {
    rowCount: 1,
    rows: [{ get_or_create_user_by_sub: 1 }],
  });
  const req = ({
    user: {
      sub: "google:1",
      permissions: [],
      "https://seasketch.org/canonical_email": "chad@example.com",
      "https://seasketch.org/email_verified": false,
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  middleware(req, null, () => {
    expect(req.user?.id).toBe(1);
    done();
  });
});

test("user claims normalized (canonical_email, email_verified, superuser)", (done) => {
  //@ts-ignore
  pool.add("select get_or_create_user_by_sub($1)", ["string"], {
    rowCount: 1,
    rows: [{ get_or_create_user_by_sub: 1 }],
  });
  const req = ({
    user: {
      sub: "google:1",
      permissions: [],
      "https://seasketch.org/canonical_email": "chad@example.com",
      "https://seasketch.org/email_verified": false,
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  middleware(req, null, () => {
    expect(req.user?.id).toBe(1);
    expect(req.user?.canonicalEmail).toBe("chad@example.com");
    expect(req.user?.emailVerified).toBe(false);
    expect(req.user?.superuser).toBe(false);
    done();
  });
});

test("superuser role properly identified", (done) => {
  //@ts-ignore
  pool.add("select get_or_create_user_by_sub($1)", ["string"], {
    rowCount: 1,
    rows: [{ get_or_create_user_by_sub: 1 }],
  });
  const req = ({
    user: {
      sub: "google:1",
      "https://seasketch.org/superuser": true,
      "https://seasketch.org/canonical_email": "chad@example.com",
      "https://seasketch.org/email_verified": true,
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  middleware(req, null, () => {
    expect(req.user?.superuser).toBe(true);
    done();
  });
});
