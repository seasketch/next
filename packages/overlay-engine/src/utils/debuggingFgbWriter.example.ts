import { DebuggingFgbWriter, FieldDefinition } from "./debuggingFgbWriter";
import { Feature, Point, Polygon } from "geojson";

/**
 * Example usage of DebuggingFgbWriter
 */
async function exampleUsage() {
  // Define the field schema for your FGB file
  const fields: FieldDefinition[] = [
    { name: "id", type: "integer" },
    { name: "name", type: "string", width: 100 },
    { name: "area", type: "real", precision: 2 },
    { name: "created_date", type: "datetime" },
  ];

  // Create a new FGB writer
  const writer = new DebuggingFgbWriter("./output.fgb", fields, "my_layer");

  try {
    // Add some sample features
    const pointFeature: Feature<Point> = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-122.4194, 37.7749], // San Francisco
      },
      properties: {
        id: 1,
        name: "San Francisco",
        area: 121.4,
        created_date: new Date("2024-01-01"),
      },
    };

    const polygonFeature: Feature<Polygon> = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-122.5, 37.7],
            [-122.3, 37.7],
            [-122.3, 37.9],
            [-122.5, 37.9],
            [-122.5, 37.7],
          ],
        ],
      },
      properties: {
        id: 2,
        name: "San Francisco Bay Area",
        area: 18000.0,
        created_date: new Date("2024-01-02"),
      },
    };

    // Add features to the FGB file
    writer.addFeature(pointFeature);
    writer.addFeature(polygonFeature);

    // Get statistics
    const stats = writer.getStats();
    console.log(
      `Added ${stats.featureCount} features with ${stats.fieldCount} fields`
    );

    // Close the writer to finalize the file
    await writer.close();
    console.log("FGB file created successfully!");
  } catch (error) {
    console.error("Error creating FGB file:", error);
    // Make sure to close the writer even if there's an error
    await writer.close();
  }
}

/**
 * Example with validation errors
 */
async function exampleWithValidation() {
  const fields: FieldDefinition[] = [
    { name: "id", type: "integer" },
    { name: "name", type: "string", width: 10 }, // Short width for testing
  ];

  const writer = new DebuggingFgbWriter("./test.fgb", fields, "test_layer");

  try {
    // This will fail validation - name is too long
    const invalidFeature: Feature<Point> = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [0, 0],
      },
      properties: {
        id: 1,
        name: "This name is way too long for the field width", // Will cause error
      },
    };

    writer.addFeature(invalidFeature);
  } catch (error) {
    console.log(
      "Validation error caught:",
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    await writer.close();
  }
}

// Export for use in other files
export { exampleUsage, exampleWithValidation };
