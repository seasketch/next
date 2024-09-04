#!/usr/bin/env tsx
import { createServer } from "http";
import * as dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3005;

const server = createServer(function (req, res) {
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString(); // convert Buffer to string
    });
    req.on("end", async () => {
      const data = JSON.parse(body);
      import("./src/handleUpload").then(async (handleUpload) => {
        const s3LogPath = `s3://${process.env.BUCKET}/${data.taskId}.log.txt`;
        try {
          const outputs = await handleUpload.default(
            data.taskId,
            data.objectKey,
            data.suffix,
            data.requestingUser,
            data.skipLoggingProgress
          );
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ...outputs,
              log: s3LogPath,
            })
          );
        } catch (e) {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: (e as Error).message,
              log: s3LogPath,
            })
          );
        }
      });
    });
  } else {
    res.writeHead(200);
    res.end("Make POST requests to handle uploads locally, simulating lambda");
  }
});

server.listen(PORT);

console.log(`
Server started.
Set the following api server env var to use:
SPATIAL_UPLOADS_LAMBDA_DEV_HANDLER=http://localhost:${PORT}
`);
