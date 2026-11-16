import { createServer, Server, ServerResponse } from "node:http";
import { once } from "node:events";
import { Socket } from "node:net";
import { socketResetRetries, testRangeDispatcher } from "../scripts/testSocketRetry";

async function listen(server: Server): Promise<number> {
  server.on("clientError", () => {});
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a tcp port");
  }
  return address.port;
}

function respond(response: ServerResponse) {
  response.statusCode = 206;
  response.setHeader("Content-Length", "4");
  response.setHeader("Content-Range", "bytes 0-3/10");
  response.end("abcd");
}

function resetSocket(socket: Socket) {
  socket.resetAndDestroy();
}

describe("test range retry", () => {
  it("retries one reset on the global fetch tests use for land occupancy", async () => {
    let hits = 0;
    const server = createServer((request, response) => {
      hits += 1;
      if (hits === 1) {
        request.socket.destroy();
        return;
      }
      respond(response);
    });
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/land.h3ld`, {
        headers: { Range: "bytes=0-3" },
      });
      expect(response.status).toBe(206);
      expect(await response.text()).toBe("abcd");
      expect(hits).toBe(2);
    } finally {
      server.close();
    }
  });

  it("returns the occupancy body after two TCP resets", async () => {
    let hits = 0;
    const server = createServer((request, response) => {
      hits += 1;
      if (hits <= 2) {
        resetSocket(request.socket);
        return;
      }
      respond(response);
    });
    const port = await listen(server);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/land.h3ld`, {
        headers: { Range: "bytes=0-3" },
      });
      expect(response.status).toBe(206);
      expect(await response.text()).toBe("abcd");
      expect(hits).toBe(3);
    } finally {
      server.close();
    }
  });

  it("sends a reset GET once more and returns the second response", async () => {
    let hits = 0;
    const server = createServer((request, response) => {
      hits += 1;
      if (hits === 1) {
        request.socket.destroy();
        return;
      }
      respond(response);
    });
    const port = await listen(server);
    try {
      const response = await testRangeDispatcher(`http://127.0.0.1:${port}`).request({
        path: "/land.fgb",
        method: "GET",
        headers: { range: "bytes=0-3" },
      });
      const body = Buffer.from(await response.body.arrayBuffer());
      expect(response.statusCode).toBe(206);
      expect(body.toString()).toBe("abcd");
      expect(hits).toBe(2);
    } finally {
      server.close();
    }
  });

  it("returns the body after two TCP resets", async () => {
    let hits = 0;
    const server = createServer((request, response) => {
      hits += 1;
      if (hits <= 2) {
        resetSocket(request.socket);
        return;
      }
      respond(response);
    });
    const port = await listen(server);
    try {
      const response = await testRangeDispatcher(`http://127.0.0.1:${port}`).request({
        path: "/testing-world-ports.fgb",
        method: "GET",
        headers: { range: "bytes=0-3" },
      });
      const body = Buffer.from(await response.body.arrayBuffer());
      expect(response.statusCode).toBe(206);
      expect(body.toString()).toBe("abcd");
      expect(hits).toBe(3);
    } finally {
      server.close();
    }
  });

  it("fails after the retry budget is spent", async () => {
    let hits = 0;
    const server = createServer((request) => {
      hits += 1;
      resetSocket(request.socket);
    });
    const port = await listen(server);
    try {
      await expect(
        testRangeDispatcher(`http://127.0.0.1:${port}`).request({
          path: "/land.fgb",
          method: "GET",
        })
      ).rejects.toThrow(/read ECONNRESET/);
      expect(hits).toBe(socketResetRetries + 1);
    } finally {
      server.close();
    }
  });

  it("does not send an HTTP error a second time", async () => {
    let hits = 0;
    const server = createServer((_request, response) => {
      hits += 1;
      response.statusCode = 500;
      response.end("no");
    });
    const port = await listen(server);
    try {
      const response = await testRangeDispatcher(`http://127.0.0.1:${port}`).request({
        path: "/land.fgb",
        method: "GET",
      });
      await response.body.arrayBuffer();
      expect(response.statusCode).toBe(500);
      expect(hits).toBe(1);
    } finally {
      server.close();
    }
  });
});
