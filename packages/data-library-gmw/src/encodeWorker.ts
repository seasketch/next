import { encodeMrtTile, encodeSample } from "../../raster-array/src/mrt/encode";
import { MRT_NODATA } from "../../raster-array/src/mrt/types";

export type EncodeWorkerJob = {
  z: number;
  x: number;
  y: number;
  tileSize: number;
  buffer: number;
  nodata: number;
  gzipLevel: number;
  years: string[];
  bands: Buffer[];
};

function encodeJob(job: EncodeWorkerJob): { empty: true } | { empty: false; mrt: Buffer } {
  const encodedBands = job.bands.map((buf, i) => {
    const values = new Uint32Array(buf.length);
    for (let p = 0; p < buf.length; p++) {
      const v = buf[p]!;
      values[p] =
        v === job.nodata ? MRT_NODATA : encodeSample(v, 0, 1, job.nodata);
    }
    return { id: job.years[i]!, values };
  });
  if (encodedBands.every((b) => b.values.every((v) => v === MRT_NODATA))) {
    return { empty: true };
  }
  const mrt = encodeMrtTile({
    z: job.z,
    x: job.x,
    y: job.y,
    gzipLevel: job.gzipLevel,
    layers: [
      {
        name: "mangroves",
        units: "presence",
        tileSize: job.tileSize,
        buffer: job.buffer,
        offset: 0,
        scale: 1,
        bands: encodedBands,
        bandsPerBlock: "all",
      },
    ],
  });
  return { empty: false, mrt };
}

process.on("message", (job: EncodeWorkerJob) => {
  try {
    process.send!(encodeJob(job));
  } catch (err) {
    process.send!({ error: err instanceof Error ? err.message : String(err) });
  }
});
