import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join, basename } from "path";

export type EnviInterleave = "bsq" | "bil" | "bip";

export type EnviHeader = {
  samples: number;
  lines: number;
  bands: number;
  dataType: number;
  interleave: EnviInterleave;
  byteOrder: 0 | 1;
  headerOffset: number;
  mapInfo?: string;
  bandNames?: string[];
  dataIgnoreValue?: number;
};

const DATA_TYPE_BYTES: Record<number, number> = {
  1: 1, // byte
  2: 2, // int16
  3: 4, // int32
  4: 4, // float32
  5: 8, // float64
  12: 2, // uint16
  13: 4, // uint32
};

export function parseEnviHeader(text: string): EnviHeader {
  const lines = text.split(/\r?\n/);
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    i++;
    if (!line.trim() || line.trim() === "ENVI") continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith("{")) {
      while (!value.includes("}") && i < lines.length) {
        value += " " + lines[i]!.trim();
        i++;
      }
      value = value.replace(/[{}]/g, "").trim();
    }
    fields[key] = value;
  }
  const interleave = (fields["interleave"] || "bsq").toLowerCase() as EnviInterleave;
  return {
    samples: Number(fields["samples"]),
    lines: Number(fields["lines"]),
    bands: Number(fields["bands"] ?? 1),
    dataType: Number(fields["data type"]),
    interleave,
    byteOrder: Number(fields["byte order"] ?? 0) === 1 ? 1 : 0,
    headerOffset: Number(fields["header offset"] ?? 0),
    mapInfo: fields["map info"],
    bandNames: fields["band names"]
      ? fields["band names"].split(",").map((s) => s.trim())
      : undefined,
    dataIgnoreValue:
      fields["data ignore value"] !== undefined
        ? Number(fields["data ignore value"])
        : undefined,
  };
}

export function findEnviPair(pathWithoutExtOrHdr: string): {
  hdr: string;
  data: string;
} {
  const hdr = pathWithoutExtOrHdr.endsWith(".hdr")
    ? pathWithoutExtOrHdr
    : existsSync(pathWithoutExtOrHdr + ".hdr")
      ? pathWithoutExtOrHdr + ".hdr"
      : join(dirname(pathWithoutExtOrHdr), basename(pathWithoutExtOrHdr) + ".hdr");
  if (!existsSync(hdr)) {
    throw new Error(`ENVI header not found next to ${pathWithoutExtOrHdr}`);
  }
  const base = hdr.replace(/\.hdr$/i, "");
  const candidates = [
    base,
    base + ".img",
    base + ".bil",
    base + ".bsq",
    base + ".bip",
    base + ".dat",
  ];
  const data = candidates.find((p) => existsSync(p) && p !== hdr);
  if (!data) {
    throw new Error(`ENVI data file not found for ${hdr}`);
  }
  return { hdr, data };
}

export function readEnviBands(enviPath: string): {
  header: EnviHeader;
  bands: Float64Array[];
} {
  const { hdr, data } = existsSync(enviPath) && enviPath.endsWith(".hdr")
    ? findEnviPair(enviPath)
    : findEnviPair(enviPath);
  const header = parseEnviHeader(readFileSync(hdr, "utf8"));
  const bytesPerSample = DATA_TYPE_BYTES[header.dataType];
  if (!bytesPerSample) {
    throw new Error(`Unsupported ENVI data type ${header.dataType}`);
  }
  const buf = readFileSync(data);
  const { samples, lines, bands } = header;
  const n = samples * lines;
  const little = header.byteOrder === 0;
  const view = new DataView(buf.buffer, buf.byteOffset + header.headerOffset);
  const readAt = (sampleIndex: number): number => {
    const offset = sampleIndex * bytesPerSample;
    switch (header.dataType) {
      case 1:
        return view.getUint8(offset);
      case 2:
        return view.getInt16(offset, little);
      case 3:
        return view.getInt32(offset, little);
      case 4:
        return view.getFloat32(offset, little);
      case 5:
        return view.getFloat64(offset, little);
      case 12:
        return view.getUint16(offset, little);
      case 13:
        return view.getUint32(offset, little);
      default:
        throw new Error(`Unsupported ENVI data type ${header.dataType}`);
    }
  };

  const out: Float64Array[] = [];
  for (let b = 0; b < bands; b++) {
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let src: number;
      if (header.interleave === "bsq") {
        src = b * n + i;
      } else if (header.interleave === "bil") {
        const row = Math.floor(i / samples);
        const col = i % samples;
        src = (row * bands + b) * samples + col;
      } else {
        const row = Math.floor(i / samples);
        const col = i % samples;
        src = (row * samples + col) * bands + b;
      }
      arr[i] = readAt(src);
    }
    out.push(arr);
  }
  return { header, bands: out };
}

/** Zero-copy Byte/BSQ band views. The returned arrays alias `readFileSync` memory. */
export function readEnviBsqBytes(enviPath: string): {
  header: EnviHeader;
  bands: Uint8Array[];
} {
  const { hdr, data } =
    existsSync(enviPath) && enviPath.endsWith(".hdr")
      ? findEnviPair(enviPath)
      : findEnviPair(enviPath);
  const header = parseEnviHeader(readFileSync(hdr, "utf8"));
  if (header.dataType !== 1) {
    throw new Error(`readEnviBsqBytes expected Byte data, got type ${header.dataType}`);
  }
  if (header.interleave !== "bsq") {
    throw new Error(`readEnviBsqBytes expected BSQ, got ${header.interleave}`);
  }
  const buf = readFileSync(data);
  const n = header.samples * header.lines;
  const start = header.headerOffset;
  const bands: Uint8Array[] = [];
  for (let b = 0; b < header.bands; b++) {
    const offset = start + b * n;
    bands.push(buf.subarray(offset, offset + n));
  }
  return { header, bands };
}

export function writeEnviBsq(options: {
  dataPath: string;
  samples: number;
  lines: number;
  dataType: 1 | 4;
  west: number;
  north: number;
  xRes: number;
  yRes: number;
  bandNames: string[];
  /**
   * Packed BSQ buffer. Byte data is one byte per sample; float32 is little-endian.
   */
  data: Buffer;
  nodata?: number;
  srs?: "wgs84" | "mercator";
}): void {
  const { samples, lines, dataType, west, north, xRes, yRes, bandNames } = options;
  const hdrPath = options.dataPath.endsWith(".hdr")
    ? options.dataPath
    : options.dataPath + ".hdr";
  const rawPath = hdrPath.replace(/\.hdr$/i, "");
  const mapInfo =
    options.srs === "mercator"
      ? `{Mercator, 1.0000, 1.0000, ${west}, ${north}, ${xRes}, ${yRes}, WGS-84, units=Meters}`
      : `{Geographic Lat/Lon, 1.0000, 1.0000, ${west}, ${north}, ${xRes}, ${yRes}, WGS-84, units=Degrees}`;
  const nodataLine =
    options.nodata !== undefined ? `data ignore value = ${options.nodata}\n` : "";
  const hdr = `ENVI
description = {${basename(rawPath)}}
samples = ${samples}
lines = ${lines}
bands = ${bandNames.length}
header offset = 0
file type = ENVI Standard
data type = ${dataType}
interleave = bsq
byte order = 0
map info = ${mapInfo}
${nodataLine}band names = {${bandNames.join(", ")}}
`;
  writeFileSync(hdrPath, hdr);
  writeFileSync(rawPath, options.data);
}
