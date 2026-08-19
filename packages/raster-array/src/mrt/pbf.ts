/**
 * Minimal protobuf writer/reader for the MRT v1 subset used by mapbox-gl-js.
 * Wire types match https://protobuf.dev/programming-guides/encoding/
 */
const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

export class PbfWriter {
  private chunks: Buffer[] = [];

  get length(): number {
    return this.chunks.reduce((n, c) => n + c.length, 0);
  }

  writeRaw(buf: Buffer | Uint8Array): void {
    this.chunks.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  }

  writeVarint(value: number): void {
    let n = Math.max(0, Math.floor(value));
    const bytes: number[] = [];
    while (n > 0x7f) {
      bytes.push((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    bytes.push(n);
    this.chunks.push(Buffer.from(bytes));
  }

  /** Unsigned 32-bit varint (for pixel values, including 0xffffffff nodata). */
  writeUint32Varint(value: number): void {
    let n = value >>> 0;
    const bytes: number[] = [];
    while (n > 0x7f) {
      bytes.push((n & 0x7f) | 0x80);
      n >>>= 7;
    }
    bytes.push(n);
    this.chunks.push(Buffer.from(bytes));
  }

  writeTag(field: number, wire: number): void {
    this.writeVarint((field << 3) | wire);
  }

  writeFixed32(value: number): void {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(value >>> 0, 0);
    this.chunks.push(buf);
  }

  writeFloat(value: number): void {
    const buf = Buffer.alloc(4);
    buf.writeFloatLE(value, 0);
    this.chunks.push(buf);
  }

  writeFixed64(value: number): void {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64LE(BigInt(Math.max(0, Math.floor(value))), 0);
    this.chunks.push(buf);
  }

  writeDouble(value: number): void {
    const buf = Buffer.alloc(8);
    buf.writeDoubleLE(value, 0);
    this.chunks.push(buf);
  }

  writeString(value: string): void {
    const buf = Buffer.from(value, "utf8");
    this.writeVarint(buf.length);
    this.chunks.push(buf);
  }

  writeFixed32Field(field: number, value: number): void {
    this.writeTag(field, WIRE_FIXED32);
    this.writeFixed32(value);
  }

  writeFloatField(field: number, value: number): void {
    this.writeTag(field, WIRE_FIXED32);
    this.writeFloat(value);
  }

  writeFixed64Field(field: number, value: number): void {
    this.writeTag(field, WIRE_FIXED64);
    this.writeFixed64(value);
  }

  writeDoubleField(field: number, value: number): void {
    this.writeTag(field, WIRE_FIXED64);
    this.writeDouble(value);
  }

  writeVarintField(field: number, value: number): void {
    this.writeTag(field, WIRE_VARINT);
    this.writeVarint(value);
  }

  writeStringField(field: number, value: string): void {
    this.writeTag(field, WIRE_BYTES);
    this.writeString(value);
  }

  writeMessageField(field: number, message: Buffer): void {
    this.writeTag(field, WIRE_BYTES);
    this.writeVarint(message.length);
    this.writeRaw(message);
  }

  writePackedUint32Field(field: number, values: Uint32Array | number[]): void {
    const packed = new PbfWriter();
    for (let i = 0; i < values.length; i++) {
      packed.writeUint32Varint(values[i]!);
    }
    this.writeMessageField(field, packed.finish());
  }

  finish(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

export class PbfReader {
  wireType = 0;

  constructor(
    readonly buf: Uint8Array,
    public pos = 0,
    public end = buf.length,
  ) {}

  nextField(end = this.end): number {
    if (this.pos >= end) return 0;
    const tag = this.readVarint();
    this.wireType = tag & 7;
    return tag >>> 3;
  }

  readVarint(): number {
    let n = 0;
    let shift = 0;
    while (this.pos < this.buf.length) {
      const b = this.buf[this.pos++]!;
      n += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return n;
  }

  readUint32Varint(): number {
    let n = 0;
    let shift = 0;
    while (this.pos < this.buf.length) {
      const b = this.buf[this.pos++]!;
      n |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    return n >>> 0;
  }

  readFixed32(): number {
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      4,
    );
    this.pos += 4;
    return view.getUint32(0, true);
  }

  readFloat(): number {
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      4,
    );
    this.pos += 4;
    return view.getFloat32(0, true);
  }

  readFixed64(): number {
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      8,
    );
    this.pos += 8;
    const lo = view.getUint32(0, true);
    const hi = view.getUint32(4, true);
    return hi * 0x100000000 + lo;
  }

  readDouble(): number {
    const view = new DataView(
      this.buf.buffer,
      this.buf.byteOffset + this.pos,
      8,
    );
    this.pos += 8;
    return view.getFloat64(0, true);
  }

  readBytes(): Uint8Array {
    const len = this.readVarint();
    const start = this.pos;
    this.pos += len;
    return this.buf.subarray(start, start + len);
  }

  readString(): string {
    return Buffer.from(this.readBytes()).toString("utf8");
  }

  skip(wireType = this.wireType): void {
    if (wireType === WIRE_VARINT) this.readVarint();
    else if (wireType === WIRE_FIXED64) this.pos += 8;
    else if (wireType === WIRE_BYTES) this.readBytes();
    else if (wireType === WIRE_FIXED32) this.pos += 4;
    else throw new Error(`Unknown protobuf wire type ${wireType}`);
  }
}

export const Wire = {
  VARINT: WIRE_VARINT,
  FIXED64: WIRE_FIXED64,
  BYTES: WIRE_BYTES,
  FIXED32: WIRE_FIXED32,
};
