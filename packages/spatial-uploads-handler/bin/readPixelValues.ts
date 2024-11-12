// @ts-ignore
import sharp from "sharp";

// Function to get unique pixel values
async function getUniquePixelValues(imagePath: string): Promise<Set<string>> {
  const { data, info } = await sharp(imagePath)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const uniquePixels = new Set<string>();

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
