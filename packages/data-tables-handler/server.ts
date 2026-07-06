#!/usr/bin/env tsx
import { createServer } from "http";
import * as dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3006;

const server = createServer(function (req, res) {
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      const data = JSON.parse(body);
      try {
        const { processDataTableUpload } = await import("./handler");
        const outputs = await processDataTableUpload(data);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(outputs));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
    });
  } else {
    res.writeHead(200);
    res.end("POST to simulate data-tables-handler lambda");
  }
});

server.listen(PORT);
console.log(`Data tables handler dev server on http://localhost:${PORT}`);
console.log(`Set DATA_TABLES_LAMBDA_DEV_HANDLER=http://localhost:${PORT}`);
