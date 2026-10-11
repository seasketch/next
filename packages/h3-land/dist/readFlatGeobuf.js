"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFlatGeobuf = readFlatGeobuf;
const node_fs_1 = require("node:fs");
const node_stream_1 = require("node:stream");
const flatgeobuf_1 = require("flatgeobuf");
/**
 * Stream features from a local FlatGeobuf file. The packed index is skipped;
 * this is a full sequential read, which is what a global classification needs.
 */
async function* readFlatGeobuf(path, onHeader) {
    const web = node_stream_1.Readable.toWeb((0, node_fs_1.createReadStream)(path));
    const features = flatgeobuf_1.geojson.deserialize(web, undefined, (header) => {
        onHeader?.({ featuresCount: Number(header.featuresCount) });
    });
    for await (const feature of features) {
        yield feature;
    }
}
//# sourceMappingURL=readFlatGeobuf.js.map