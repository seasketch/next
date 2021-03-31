import { IncomingRequest } from "../src/middleware/IncomingRequest";
import pool from "../src/pool";
import currentProjectMiddlware from "../src/middleware/currentProjectMiddleware";
import { Pool } from "pg";

test("projectId set from x-ss-slug header", (done) => {
  // @ts-ignore
  pool.add("select id from projects where slug = $1", ["string"], {
    rowCount: 1,
    rows: [{ id: 1 }],
  });
  const req = ({
    headers: {
      "x-ss-slug": "cburt",
      // referer: "https://seasketch.org/p/cburt/",
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  currentProjectMiddlware(req, null, () => {
    expect(req.projectId).toBe(1);
    done();
  });
});

test("projectId set from referrer header", (done) => {
  // @ts-ignore
  pool.add("select id from projects where slug = $1", ["string"], {
    rowCount: 1,
    rows: [{ id: 1 }],
  });
  const req = ({
    headers: {
      referer: "https://seasketch.org/p/cburt/",
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  currentProjectMiddlware(req, null, () => {
    expect(req.projectId).toBe(1);
    done();
  });
});

test("unknown project slug returns error", (done) => {
  // @ts-ignore
  pool.add("select id from projects where slug = $1", ["string"], {
    rowCount: 0,
    rows: [],
  });
  const req = ({
    headers: {
      referer: "https://seasketch.org/p/cburt/",
    },
  } as unknown) as IncomingRequest;
  // @ts-ignore
  currentProjectMiddlware(req, null, (e) => {
    expect(e.toString()).toMatch(/unknown project/i);
    done();
  });
});
