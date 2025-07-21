"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rasterInfoForBands_1 = require("../src/rasterInfoForBands");
const gdal = __importStar(require("gdal-async"));
const fs = __importStar(require("fs"));
// @ts-ignore
const cliProgress = __importStar(require("cli-progress"));
const h3_js_1 = __importDefault(require("h3-js"));
const filePath = process.argv[2];
const outputFile = process.argv[3];
if (!filePath) {
    console.error("Usage: ts-node bin/raster2H3.ts <path-to-geotif> <output-file>");
    process.exit(1);
}
if (!outputFile) {
    console.error("Output file required");
    process.exit(1);
}
const output = fs.createWriteStream(outputFile);
output.write("index,value\n");
async function run() {
    let stats;
    if (filePath.endsWith(".shp") ||
        filePath.endsWith(".geojson") ||
        filePath.endsWith(".json") ||
        filePath.endsWith(".fgb")) {
        throw new Error("Unsupported file type");
    }
    else if (filePath.endsWith(".tif")) {
        stats = await (0, rasterInfoForBands_1.rasterInfoForBands)(filePath);
        if (stats.bands[0].stats.categories.length > 20) {
            throw new Error("Too many categories for H3 conversion");
        }
        const ds = gdal.open(filePath);
        const band = ds.bands.get(1);
        const size = band.size;
        const pixelCount = band.size.x * band.size.y;
        const transform = ds.geoTransform;
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(pixelCount, 0);
        let num = 0;
        for (var j = 0; j < size.y; j++) {
            const values = band.pixels.read(0, j, size.x, 1);
            for (var i = 0; i < size.x; i++) {
                const value = values[i];
                // get the center of the pixel in lat/lon
                const x = transform[0] + i * transform[1] + j * transform[2];
                const y = transform[3] + i * transform[4] + j * transform[5];
                // convert from projected coordinate space to lat/lon
                if (value !== 255) {
                    const index = h3_js_1.default.latLngToCell(y, x, 11);
                    // console.log(x, y, index, value);
                    output.write(`${index},${value}\n`);
                }
                num++;
                if (num % 10000 === 0) {
                    progressBar.update(num);
                }
            }
        }
        progressBar.stop();
        output.end();
    }
    else {
        console.error("Unsupported file type");
        process.exit(1);
    }
    if (stats.bands.length === 0) {
        throw new Error("No bands found in raster");
    }
}
run();
