import { createServer, Server } from "node:http";
import { once } from "node:events";
import { Socket } from "node:net";
import { Pool } from "undici";
import { afterEach, describe, expect, it } from "vitest";
import { makeFetchRangeFn } from "../scripts/optimizedFetchRangeFn";

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

/** Answers once per socket, then resets the next request on it. */
function reuseResetServer() {
  const served = new WeakSet<Socket>();
  const sockets = new Set<Socket>();
  let requests = 0;
  const server = createServer((req, res) => {
    requests += 1;
    const socket = req.socket;
    sockets.add(socket);
    silence(socket);
    if (served.has(socket)) {
      socket.resetAndDestroy();
      return;
    }
    served.add(socket);
    res.writeHead(206, { "Content-Length": String(BODY.length) });
    res.end(BODY);
  });
  return {
    server,
    get requests() {
      return requests;
    },
    get sockets() {
      return sockets.size;
    },
  };
}

/** Finishes the 206, then resets the socket a few milliseconds later. */
function delayedResetServer() {
  const sockets = new Set<Socket>();
  let requests = 0;
  const server = createServer((req, res) => {
    requests += 1;
    sockets.add(req.socket);
    silence(req.socket);
    res.writeHead(206, { "Content-Length": String(BODY.length) });
    res.end(BODY, () => {
      setTimeout(() => req.socket.resetAndDestroy(), 5);
    });
  });
  return {
    server,
    get requests() {
      return requests;
    },
    get sockets() {
      return sockets.size;
    },
  };
}

describe("keep-alive socket reset", () => {
  it("is read ECONNRESET when the next range reuses the reset socket", async () => {
    const probe = reuseResetServer();
    const pool = new Pool(`http://127.0.0.1:${await listen(probe.server)}`, {
      connections: 1,
      bodyTimeout: 10_000,
    });
    pools.push(pool);
    const read = async (path: string) => {
      const response = await pool.request({
        path,
        method: "GET",
        headers: { Range: "bytes=0-15" },
      });
      return response.body.arrayBuffer();
    };

    expect(Buffer.from(await read("/a")).equals(BODY)).toBe(true);
    await expect(read("/b")).rejects.toMatchObject({
      code: "ECONNRESET",
      message: "read ECONNRESET",
    });
  });

  it("opens a new socket per range when keep-alive is off", async () => {
    const probe = delayedResetServer();
    const port = await listen(probe.server);
    const { fetchRangeFn } = makeFetchRangeFn(`http://127.0.0.1:${port}`);

    for (let i = 0; i < 20; i++) {
      const buffer = await fetchRangeFn(
        `https://uploads.seasketch.org/file-${i}.fgb`,
        [0, BODY.length - 1],
      );
      expect(Buffer.from(buffer).equals(BODY)).toBe(true);
    }
    expect(probe.requests).toBe(20);
    expect(probe.sockets).toBe(20);
  });
});
