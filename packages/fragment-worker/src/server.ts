#!/usr/bin/env tsx
// Local stand-in for the fragment-worker Lambda. The API posts the same JSON
// event the Lambda receives and reads the JSON result back.
import { createServer } from "http";
import { lambdaHandler } from "./lambda";

const port = Number(process.env.PORT || 3008);

const server = createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("POST a fragment-worker Lambda event");
    return;
  }
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => {
    chunks.push(chunk as Buffer);
  });
  req.on("end", async () => {
    try {
      const event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const result = await lambdaHandler(event, {} as never);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: false, error: message }));
    }
  });
});

server.listen(port, () => {
  console.log(`Fragment worker dev server on http://localhost:${port}`);
  console.log(`Set FRAGMENT_WORKER_DEV_HANDLER=http://localhost:${port}`);
});
