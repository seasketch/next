#!/usr/bin/env tsx
import { createServer } from "http";
import * as dotenv from "dotenv";
import handler, {
  validatePayload,
  OverlayWorkerResponse,
} from "./src/overlay-worker";
dotenv.config();

const PORT = process.env.PORT || 3006;

const server = createServer(function (req, res) {
  const jobKey = Math.random().toString(36).substring(2, 15);
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString(); // convert Buffer to string
    });
    req.on("end", async () => {
      const data = JSON.parse(body);
      import("./src/overlay-worker").then(async (overlayWorker) => {
        try {
          const payload = validatePayload(data);
          res.setHeader("Content-Type", "application/json");
          // create random job key
          handler(payload, jobKey).then(() => {
            console.log("Job finished", jobKey);
          });
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobKey,
            } as OverlayWorkerResponse)
          );
        } catch (e) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              jobKey,
              error: (e as Error).message,
            })
          );
        }
      });
    });
  } else {
    res.writeHead(200);
    res.end("Make POST requests, simulating lambda");
  }
});

server.listen(PORT);

console.log(`
Server started.
Set the following api server env var to use:
OVERLAY_WORKER_DEV_HANDLER=http://localhost:${PORT}
`);
