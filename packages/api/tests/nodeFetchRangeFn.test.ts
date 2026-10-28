import http from "http";
import { AddressInfo } from "net";
import {
  makeNodeFetchRangeFn,
  makeUrlFetchRangeFn,
} from "../src/nodeFetchRangeFn";

type Probe = {
  origin: string;
  requests: { path: string; range?: string }[];
  hold: Promise<void> | null;
  statusCode: number;
  body: Buffer;
  close: () => Promise<void>;
};

function startProbe(body = "abcdefghij"): Promise<Probe> {
  const probe: Probe = {
    origin: "",
    requests: [],
    hold: null,
    statusCode: 206,
    body: Buffer.from(body),
    close: () => Promise.resolve(),
  };
  const server = http.createServer((req, res) => {
    probe.requests.push({
      path: req.url || "",
      range: req.headers.range,
    });
    const finish = () => {
      res.statusCode = probe.statusCode;
      res.end(probe.body);
    };
    if (probe.hold) {
      probe.hold.then(finish, finish);
    } else {
      finish();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      probe.origin = `http://127.0.0.1:${address.port}`;
      probe.close = () =>
        new Promise((done) => {
          server.close(() => done());
        });
      resolve(probe);
    });
  });
}

async function untilRequests(probe: Probe, count: number) {
  const started = Date.now();
  while (probe.requests.length < count) {
    if (Date.now() - started > 2000) {
      throw new Error(
        `expected ${count} requests, saw ${probe.requests.length}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe("makeUrlFetchRangeFn", () => {
  let probe: Probe;
  let log: jest.SpyInstance;

  beforeEach(async () => {
    probe = await startProbe();
    log = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    log.mockRestore();
    await probe.close();
  });

  it("requests the URL path and an explicit byte range", async () => {
    const { fetchRangeFn } = makeUrlFetchRangeFn();
    const bytes = await fetchRangeFn(`${probe.origin}/dir/file.fgb?v=2`, [
      4,
      7,
    ]);

    expect(probe.requests).toEqual([
      { path: "/dir/file.fgb?v=2", range: "bytes=4-7" },
    ]);
    expect(Buffer.from(bytes).toString()).toBe("abcdefghij");
  });

  it("leaves the range open when the end is null, and keeps an end of zero", async () => {
    const { fetchRangeFn } = makeUrlFetchRangeFn();
    await fetchRangeFn(`${probe.origin}/a.fgb`, [0, null]);
    await fetchRangeFn(`${probe.origin}/a.fgb`, [0, 0]);

    expect(probe.requests.map((request) => request.range)).toEqual([
      "bytes=0-",
      "bytes=0-0",
    ]);
  });

  it("serves a repeated range from the LRU and counts the hit", async () => {
    const client = makeUrlFetchRangeFn();
    const first = await client.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);
    const second = await client.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);

    expect(probe.requests).toHaveLength(1);
    expect(Buffer.from(second)).toEqual(Buffer.from(first));
    expect(client.cacheMisses).toBe(1);
    expect(client.cacheHits).toBe(1);
  });

  it("shares one in-flight request across concurrent callers", async () => {
    let release: () => void = () => undefined;
    probe.hold = new Promise((resolve) => {
      release = resolve;
    });
    const client = makeUrlFetchRangeFn();
    const first = client.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);
    const second = client.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);

    await untilRequests(probe, 1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(probe.requests).toHaveLength(1);
    expect(client.cacheMisses).toBe(1);
    expect(client.cacheHits).toBe(1);

    release();
    const [left, right] = await Promise.all([first, second]);
    expect(Buffer.from(left)).toEqual(Buffer.from(right));
    expect(probe.requests).toHaveLength(1);
  });

  it("does not share cache entries between callers", async () => {
    const first = makeUrlFetchRangeFn();
    const second = makeUrlFetchRangeFn();
    await first.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);
    await second.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);

    expect(probe.requests).toHaveLength(2);
    expect(first.cacheHits).toBe(0);
    expect(second.cacheMisses).toBe(1);
  });

  it("drops an entry that no longer fits", async () => {
    probe.body = Buffer.from("abcd");
    const client = makeUrlFetchRangeFn(4);
    await client.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);
    await client.fetchRangeFn(`${probe.origin}/b.fgb`, [0, 3]);
    await client.fetchRangeFn(`${probe.origin}/a.fgb`, [0, 3]);

    expect(probe.requests.map((request) => request.path)).toEqual([
      "/a.fgb",
      "/b.fgb",
      "/a.fgb",
    ]);
  });

  it("does not cache a failed response, and names the URL and range", async () => {
    probe.statusCode = 500;
    const client = makeUrlFetchRangeFn();
    const url = `${probe.origin}/missing.fgb`;

    await expect(client.fetchRangeFn(url, [1, 2])).rejects.toThrow(
      `HTTP 500 fetching ${url} range=1-2`
    );
    await expect(client.fetchRangeFn(url, [1, 2])).rejects.toThrow(
      `HTTP 500 fetching ${url} range=1-2`
    );

    expect(probe.requests).toHaveLength(2);
    expect(client.cacheHits).toBe(0);
    expect(client.cacheMisses).toBe(2);
    expect(log).toHaveBeenCalledWith(
      "rethrowing error for",
      `${url} range=1-2`
    );
  });
});

describe("makeNodeFetchRangeFn", () => {
  let probe: Probe;

  beforeEach(async () => {
    probe = await startProbe();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await probe.close();
  });

  it("joins the root and the key, then uses the same cache", async () => {
    const client = makeNodeFetchRangeFn(probe.origin);
    await client.fetchRangeFn("/dir/file.fgb", [2, 5]);
    await client.fetchRangeFn("/dir/file.fgb", [2, 5]);

    expect(probe.requests).toEqual([
      { path: "/dir/file.fgb", range: "bytes=2-5" },
    ]);
    expect(client.cacheMisses).toBe(1);
    expect(client.cacheHits).toBe(1);
  });
});
