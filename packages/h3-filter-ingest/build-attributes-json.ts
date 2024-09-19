import generateGeostats from "./src/generateGeostats";
import { writeFileSync } from "node:fs";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Please provide a file path");
  process.exit(1);
}

generateGeostats(filePath).then((attributes) => {
  // write json to output/attributes.json
  writeFileSync("output/attributes.json", JSON.stringify(attributes, null, 2));
  console.log("attributes.json written to output/attributes.json");
});
