# DebuggingFgbWriter

A utility class for easily creating FlatGeobuf (FGB) files with GeoJSON features and field validation.

## Features

- **Easy FGB Creation**: Simple API to create new FGB files
- **Field Schema Validation**: Validates feature properties against defined field schemas
- **Geometry Support**: Supports all GeoJSON geometry types (Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection)
- **Type Safety**: Full TypeScript support with proper type checking
- **Error Handling**: Comprehensive error handling with descriptive messages

## Usage

### Basic Example

```typescript
import { DebuggingFgbWriter, FieldDefinition } from "./debuggingFgbWriter";
import { Feature, Point } from "geojson";

// Define your field schema
const fields: FieldDefinition[] = [
  { name: "id", type: "integer" },
  { name: "name", type: "string", width: 100 },
  { name: "area", type: "real", precision: 2 },
  { name: "created_date", type: "datetime" },
];

// Create a new FGB writer
const writer = new DebuggingFgbWriter("./output.fgb", fields, "my_layer");

try {
  // Add features
  const feature: Feature<Point> = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [-122.4194, 37.7749],
    },
    properties: {
      id: 1,
      name: "San Francisco",
      area: 121.4,
      created_date: new Date("2024-01-01"),
    },
  };

  writer.addFeature(feature);

  // Get statistics
  const stats = writer.getStats();
  console.log(`Added ${stats.featureCount} features`);

  // Close to finalize the file
  await writer.close();
} catch (error) {
  console.error("Error:", error);
  await writer.close();
}
```

### Field Types

The following field types are supported:

- **string**: Text data with optional width limit
- **integer**: Whole numbers
- **real**: Decimal numbers with optional precision
- **date**: Date values (Date objects or ISO strings)
- **time**: Time values (Date objects or ISO strings)
- **datetime**: Date and time values (Date objects or ISO strings)

### Field Options

- **width**: Maximum length for string fields
- **precision**: Decimal places for real fields

### Geometry Types

All GeoJSON geometry types are supported:

- Point
- LineString
- Polygon
- MultiPoint
- MultiLineString
- MultiPolygon
- GeometryCollection

### Validation

The writer automatically validates:

- Required fields are present
- Field types match the schema
- String lengths don't exceed width limits
- Numbers are valid
- Dates are valid Date objects or parseable strings

### Error Handling

The class provides detailed error messages for:

- Missing required fields
- Type mismatches
- Invalid geometries
- GDAL operation failures

## API Reference

### Constructor

```typescript
constructor(path: string, fields: FieldDefinition[], layerName?: string)
```

- **path**: Output file path for the FGB file
- **fields**: Array of field definitions
- **layerName**: Optional layer name (defaults to "layer")

### Methods

#### `addFeature(feature: Feature<any>): void`

Adds a GeoJSON feature to the FGB file with validation.

#### `close(): Promise<void>`

Closes the writer and finalizes the FGB file. **Always call this when done!**

#### `getStats(): { featureCount: number; fieldCount: number }`

Returns statistics about the written features.

## Dependencies

- `gdal-async`: For GDAL operations
- `geojson`: For GeoJSON type definitions

## Notes

- The writer automatically sets the spatial reference system to WGS84 (EPSG:4326)
- Features are validated against the schema before being written
- The FGB file is created with the FlatGeobuf driver
- Always use try-catch blocks and ensure `close()` is called to prevent file corruption
