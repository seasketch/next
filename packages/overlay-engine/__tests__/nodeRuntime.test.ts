import { createServer } from "node:http";
import { once } from "node:events";
import gdal from "gdal-async";
import { Pool } from "undici";
import { describe, expect, it } from "vitest";

describe("Node 24 runtime", () => {
  it("loads the gdal-async native binding for this ABI", () => {
    // Node 24 is NODE_MODULE_VERSION 137. A tree installed on an older
    // Node only has the older binding, and require throws.
    expect(gdal.version.startsWith("3.")).toBe(true);
    expect(gdal.drivers.count()).toBeGreaterThan(0);
  });

  it("reads a byte range through undici's connection cap", async () => {
    const server = createServer((req, res) => {
      if (req.headers.range !== "bytes=0-3") {
        res.statusCode = 400;
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", "bytes 0-3/10");
      res.end("abcd");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a tcp port");
    }
    // Same Pool options as makeFetchRangeFn. Undici 7, which Node 24 ships,
    // is what that helper imports.
    const pool = new Pool(`http://127.0.0.1:${address.port}`, {
      connections: 8,
      bodyTimeout: 10 * 1000,
    });
    try {
      const response = await pool.request({
        path: "/tile",
        method: "GET",
        headers: { Range: "bytes=0-3" },
      });
      const body = Buffer.from(await response.body.arrayBuffer());
      expect(response.statusCode).toBe(206);
      expect(body.toString()).toBe("abcd");
    } finally {
      await pool.close();
      server.close();
      await once(server, "close");
    }
  });
});
