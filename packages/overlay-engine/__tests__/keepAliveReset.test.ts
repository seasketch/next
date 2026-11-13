import { createServer, Server } from "node:http";
import http2 from "node:http2";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "undici";
import { afterEach, describe, expect, it } from "vitest";

const BODY = Buffer.from("0123456789abcdef");

const servers: Array<Server | http2.Http2SecureServer> = [];
const pools: Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map((pool) => pool.close()));
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          const closer = server as Server;
          if (typeof closer.closeAllConnections === "function") {
            closer.closeAllConnections();
          }
          server.close(() => resolve());
        }),
    ),
  );
});

async function listen(server: Server | http2.Http2SecureServer): Promise<number> {
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a tcp port");
  }
  return address.port;
}

describe("upload range transport", () => {
  it("is read ECONNRESET when the next HTTP/1.1 range reuses a reset socket", async () => {
    const served = new WeakSet<Socket>();
    const server = createServer((req, res) => {
      const socket = req.socket;
      socket.on("error", () => undefined);
      if (served.has(socket)) {
        socket.resetAndDestroy();
        return;
      }
      served.add(socket);
      res.writeHead(206, { "Content-Length": String(BODY.length) });
      res.end(BODY);
    });
    const pool = new Pool(`http://127.0.0.1:${await listen(server)}`, {
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

  it("serves many ranges on one HTTP/2 session", async () => {
    const dir = mkdtempSync(join(tmpdir(), "h2-"));
    const key = join(dir, "key.pem");
    const cert = join(dir, "cert.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=localhost",
      ],
      { stdio: "ignore" },
    );
    const sessions = new Set<http2.Http2Session>();
    const server = http2.createSecureServer({
      key: readFileSync(key),
      cert: readFileSync(cert),
    });
    server.on("stream", (stream) => {
      sessions.add(stream.session);
      stream.respond({ ":status": 206, "content-length": BODY.length });
      stream.end(BODY);
    });
    const pool = new Pool(`https://127.0.0.1:${await listen(server)}`, {
      allowH2: true,
      connections: 1,
      bodyTimeout: 10_000,
      connect: { rejectUnauthorized: false },
    });
    pools.push(pool);
    let connects = 0;
    pool.on("connect", () => {
      connects += 1;
    });

    for (let i = 0; i < 20; i++) {
      const response = await pool.request({
        path: "/file.fgb",
        method: "GET",
        headers: { Range: "bytes=0-15" },
      });
      const buffer = Buffer.from(await response.body.arrayBuffer());
      expect(response.statusCode).toBe(206);
      expect(buffer.equals(BODY)).toBe(true);
    }
    expect(connects).toBe(1);
    expect(sessions.size).toBe(1);
  });
});
