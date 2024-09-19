import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export async function countLines(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    let lineCount = 0;

    const fileStream = createReadStream(filePath);

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    rl.on("line", () => {
      lineCount++;
    });

    rl.on("close", () => {
      resolve(lineCount);
    });

    rl.on("error", (err) => {
      reject(err);
    });
  });
}
