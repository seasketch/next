"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore
const sharp_1 = __importDefault(require("sharp"));
// Function to get unique pixel values
async function getUniquePixelValues(imagePath) {
    const { data, info } = await (0, sharp_1.default)(imagePath)
        .raw()
        .toBuffer({ resolveWithObject: true });
    const uniquePixels = new Set();
    for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const color = `${r}\t${g}\t${b}`;
        uniquePixels.add(color);
    }
    return uniquePixels;
}
// Get the image path from command-line arguments
const imagePath = process.argv[2];
if (!imagePath) {
    console.error("Please provide the path to an image.");
    process.exit(1);
}
// Example usage
getUniquePixelValues(imagePath)
    .then((uniquePixels) => {
    console.log(`Unique Pixel Values: `);
    for (const pixel of Array.from(uniquePixels)) {
        console.log(pixel);
    }
})
    .catch((err) => {
    console.error("Error:", err);
});
//# sourceMappingURL=readPixelValues.js.map