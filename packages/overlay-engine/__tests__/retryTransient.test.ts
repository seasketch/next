import { createServer, Server } from "node:http";
import { once } from "node:events";
import { Socket } from "node:net";
import { Pool } from "undici";
import { afterEach, describe, expect, it } from "vitest";
import { makeFetchRangeFn } from "../scripts/optimizedFetchRangeFn";
import {
  isTransientSocketError,
  retryTransient,
  TRANSIENT_SOCKET_ATTEMPTS,
} from "../src/retryTransient";

const BODY = Buffer.from("0123456789abcdef");

const servers: Server[] = [];
const pools: Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.close()));
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function listen(server: Server): Promise<number> {
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a tcp port");
  }
  return address.port;
}

function silence(socket: Socket) {
  socket.on("error", () => undefined);
}

/**
 * First request on a socket gets a 206. The next request on that same
 * socket is reset, which is what a keep-alive peer does when it has already
 * aborted the idle connection.
 */
function reuseResetServer() {
  const served = new WeakSet<Socket>();
  let requests = 0;
  const server = createServer((req, res) => {
    requests += 1;
    const socket = req.socket;
    silence(socket);
    if (served.has(socket)) {
      socket.resetAndDestroy();
      return;
    }
    served.add(socket);
    res.writeHead(206, {
      "Content-Range": `bytes 0-${BODY.length - 1}/${BODY.length}`,
      "Content-Length": String(BODY.length),
    });
    res.end(BODY);
  });
  return {
    server,
    get requests() {
      return requests;
    },
  };
}

function alwaysResetServer() {
  let requests = 0;
  const server = createServer((req) => {
    requests += 1;
    silence(req.socket);
    req.socket.resetAndDestroy();
  });
  return {
    server,
    get requests() {
      return requests;
    },
  };
}

function openPool(port: number, connections = 1): Pool {
  const pool = new Pool(`http://127.0.0.1:${port}`, {
    connections,
    bodyTimeout: 10_000,
  });
  pools.push(pool);
  return pool;
}

async function readRange(pool: Pool, path: string): Promise<ArrayBuffer> {
  const response = await pool.request({
    path,
    method: "GET",
    headers: { Range: `bytes=0-${BODY.length - 1}` },
  });
  return response.body.arrayBuffer();
}

describe("keep-alive socket reset", () => {
  it("is read ECONNRESET when the next range reuses the reset socket", async () => {
    const probe = reuseResetServer();
    const pool = openPool(await listen(probe.server));

    const first = await readRange(pool, "/a");
    expect(Buffer.from(first).equals(BODY)).toBe(true);

    await expect(readRange(pool, "/b")).rejects.toMatchObject({
      code: "ECONNRESET",
      message: "read ECONNRESET",
    });
    expect(probe.requests).toBe(2);
  });

  it("completes the range on a new socket", async () => {
    const probe = reuseResetServer();
    const pool = openPool(await listen(probe.server));
    const read = (path: string) => retryTransient(() => readRange(pool, path));

    expect(Buffer.from(await read("/a")).equals(BODY)).toBe(true);
    expect(Buffer.from(await read("/b")).equals(BODY)).toBe(true);
    expect(probe.requests).toBe(3);
  });

  it("retries inside the overlay range fetch used by the engine tests", async () => {
    const probe = reuseResetServer();
    const port = await listen(probe.server);
    const { fetchRangeFn } = makeFetchRangeFn(`http://127.0.0.1:${port}`);

    for (let i = 0; i < 6; i++) {
      const buffer = await fetchRangeFn(
        `https://uploads.seasketch.org/file-${i}.fgb`,
        [0, BODY.length - 1],
      );
      expect(Buffer.from(buffer).equals(BODY)).toBe(true);
    }
    // Each reuse is reset. The server can miss a request that dies before
    // the HTTP parser runs, so the count is the 6 bodies plus some resets,
    // not a fixed total.
    expect(probe.requests).toBeGreaterThan(6);
    expect(probe.requests).toBeLessThanOrEqual(11);
  });

  it("stops after the attempt budget when every socket is reset", async () => {
    const probe = alwaysResetServer();
    const port = await listen(probe.server);
    const { fetchRangeFn } = makeFetchRangeFn(`http://127.0.0.1:${port}`);
    const url = "https://uploads.seasketch.org/land-big-2.fgb";

    await expect(fetchRangeFn(url, [0, 15])).rejects.toThrow(
      /ECONNRESET.*land-big-2\.fgb range=0-15/,
    );
    expect(probe.requests).toBe(TRANSIENT_SOCKET_ATTEMPTS);
  });
});

describe("isTransientSocketError", () => {
  it("rejects values that are not a socket failure", () => {
    expect(isTransientSocketError(null)).toBe(false);
    expect(isTransientSocketError(undefined)).toBe(false);
    expect(isTransientSocketError(0)).toBe(false);
    expect(isTransientSocketError("HTTP 500")).toBe(false);
    expect(isTransientSocketError(new Error("HTTP 500 fetching"))).toBe(false);
    expect(isTransientSocketError({ code: "HTTP_500" })).toBe(false);
  });

  it("accepts the raw code, the wrapped message, and a cause", () => {
    expect(
      isTransientSocketError(
        Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      ),
    ).toBe(true);
    expect(
      isTransientSocketError(
        new Error(
          "read ECONNRESET. https://uploads.seasketch.org/a.fgb range=1-2: read ECONNRESET",
        ),
      ),
    ).toBe(true);
    expect(
      isTransientSocketError(
        new Error("failed", {
          cause: Object.assign(new Error("read ECONNRESET"), {
            code: "ECONNRESET",
          }),
        }),
      ),
    ).toBe(true);
    expect(
      isTransientSocketError({ code: "UND_ERR_SOCKET", message: "other side closed" }),
    ).toBe(true);
  });

  it("does not retry an application error or a body timeout", async () => {
    let calls = 0;
    await expect(
      retryTransient(async () => {
        calls += 1;
        throw new Error("HTTP 500 fetching");
      }),
    ).rejects.toThrow("HTTP 500 fetching");
    expect(calls).toBe(1);

    calls = 0;
    const timeout = Object.assign(new Error("Body Timeout Error"), {
      code: "UND_ERR_BODY_TIMEOUT",
    });
    await expect(
      retryTransient(async () => {
        calls += 1;
        throw timeout;
      }),
    ).rejects.toBe(timeout);
    expect(calls).toBe(1);
  });
});
