/**
 * RFC 9110 byte-range for an already-in-memory body (extracted PMTiles tile).
 * Oversize last-byte-pos is clamped — GL JS probes MRT with 0-16383.
 */
export type SlicedRange = {
  status: 200 | 206 | 416;
  body: ArrayBuffer;
  contentRange?: string;
};

export function sliceByteRange(
  data: ArrayBuffer,
  rangeHeader: string | null,
): SlicedRange {
  const size = data.byteLength;
  if (!rangeHeader) {
    return { status: 200, body: data };
  }
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) {
    return { status: 416, body: new ArrayBuffer(0), contentRange: `bytes */${size}` };
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= size ||
    start > end
  ) {
    return { status: 416, body: new ArrayBuffer(0), contentRange: `bytes */${size}` };
  }
  return {
    status: 206,
    body: data.slice(start, end + 1),
    contentRange: `bytes ${start}-${end}/${size}`,
  };
}
