import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const pkg = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(pkg, "node_modules", "wrangler", "bin", "wrangler.js");
const TOKEN = "integration-test-token";
const PORT = 8792;

const page = `<!doctype html>
<html>
  <body style="margin:0;background:#c23b22">
    <script>
      window.showBookmark = () => {
        const mark = document.createElement("div");
        mark.id = "loaded";
        document.body.appendChild(mark);
      };
    </script>
  </body>
</html>`;

function startFixture() {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("fixture server has no port"));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

function startWorker() {
  const child = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--ip",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--var",
      `SCREENSHOTTER_TOKEN:${TOKEN}`,
      "--var",
      "SCREENSHOTTER_ALLOW_LOCALHOST:true",
      "--no-show-interactive-dev-session",
    ],
    {
      cwd: pkg,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let logs = "";
  const keep = (chunk) => {
    logs = (logs + chunk.toString()).slice(-8000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  return {
    logs: () => logs,
    stop() {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    },
  };
}

async function waitForHealth(logs) {
  const deadline = Date.now() + 120_000;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
      last = `status ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `local screenshotter did not become ready (${last})\n${logs()}`
  );
}

test("wrangler dev on this machine returns a PNG", async (t) => {
  const fixture = await startFixture();
  const worker = startWorker();
  t.after(() => {
    worker.stop();
    fixture.server.close();
  });
  await waitForHealth(worker.logs);

  const response = await fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      width: 640,
      height: 480,
      url: `http://127.0.0.1:${fixture.port}/screenshot.html`,
      bookmarkData: { id: "local" },
    }),
    signal: AbortSignal.timeout(70_000),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(
    response.status,
    200,
    `expected a PNG, got ${response.status}: ${new TextDecoder().decode(bytes).slice(0, 500)}\n${worker.logs()}`
  );
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  assert.ok(bytes.byteLength > 1000);
});
