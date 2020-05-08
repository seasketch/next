import pool from "../pool";
import { getPGSessionSettings, IncomingRequest } from "./index";

test("anonymous user gets anon role", async () => {
  const req = {} as IncomingRequest;
  const settings = await getPGSessionSettings(req);
  expect(settings.role).toBe("anon");
  expect(settings["session.project_id"]).toBeFalsy();
  expect(settings["session.user_id"]).toBeFalsy();
});

test("project id is not set when anon", async () => {
  const req = ({
    headers: {
      "x-ss-slug": "cburt",
      referer: "https://seasketch.org/cburt/",
    },
  } as unknown) as IncomingRequest;
  const settings = await getPGSessionSettings(req);
  expect(settings.role).toBe("anon");
  expect(settings["session.project_id"]).toBeFalsy();
  expect(settings["session.user_id"]).toBeFalsy();
});

test("user with session", async () => {
  //@ts-ignore
  pool.add("select id from projects where slug = $1", ["string"], {
    rowCount: 1,
    rows: [{ id: 1 }],
  });
  //@ts-ignore
  pool.add("select get_or_create_user_by_sub($1)", ["string"], {
    rowCount: 1,
    rows: [{ get_or_create_user_by_sub: 1 }],
  });
  const req = ({
    headers: {
      "x-ss-slug": "cburt",
      referer: "https://seasketch.org/cburt/",
    },
    user: {
      sub: "mock|abc123",
    },
  } as unknown) as IncomingRequest;
  const settings = await getPGSessionSettings(req);
  expect(settings.role).toBe("seasketch_user");
  expect(settings["session.project_id"]).toBe(1);
  expect(settings["session.user_id"]).toBe(1);
});

test("Unknown project", async () => {
  expect.assertions(1);
  //@ts-ignore
  pool.add("select id from projects where slug = $1", ["string"], {
    rowCount: 0,
    rows: [],
  });
  //@ts-ignore
  pool.add("select get_or_create_user_by_sub($1)", ["string"], {
    rowCount: 1,
    rows: [{ get_or_create_user_by_sub: 1 }],
  });
  const req = ({
    headers: {
      "x-ss-slug": "cburt",
      referer: "https://seasketch.org/cburt/",
    },
    user: {
      sub: "mock|abc123",
    },
  } as unknown) as IncomingRequest;
  return expect(getPGSessionSettings(req)).rejects.toThrow(/project/);
});

test("superusers", async () => {
  // @ts-ignore
  pool.add("select id from projects where slug = $1", ["string"], {
    rowCount: 1,
    rows: [{ id: 1 }],
  });
  //@ts-ignore
  pool.add("select get_or_create_user_by_sub($1)", ["string"], {
    rowCount: 1,
    rows: [{ get_or_create_user_by_sub: 1 }],
  });
  const req = ({
    headers: {
      "x-ss-slug": "cburt",
      referer: "https://seasketch.org/cburt/",
    },
    user: {
      sub: "mock|abc123",
      permissions: ["foo", "superuser", "bar"],
    },
  } as unknown) as IncomingRequest;
  const settings = await getPGSessionSettings(req);
  expect(settings.role).toBe("seasketch_superuser");
  expect(settings["session.project_id"]).toBe(1);
  expect(settings["session.user_id"]).toBe(1);
});
