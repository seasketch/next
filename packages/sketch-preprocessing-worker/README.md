# Sketch Preprocessing Worker

A Cloudflare Worker that handles the preprocessing and clipping of sketch geometries against various geographic boundaries. This worker is a critical component in the SeaSketch platform's spatial analysis pipeline.

## Overview

The Sketch Preprocessing Worker provides two main endpoints:

1. `/clip` - Clips a sketch geometry against one or more Geographies
2. `/warm-cache` - Pre-warms the cache for upcoming clipping operations

In SeaSketch, a Geography represents a geographic boundary that serves two key purposes:

- A region where users can draw sketches (plans) for spatial planning
- A geographic region that analytical outputs are grouped by for reporting and analysis

The worker is designed to efficiently handle spatial operations by:

- Using Cloudflare R2 for storing and retrieving geographic data
- Implementing a caching layer for frequently accessed data
- Supporting parallel processing of multiple Geographies
- Handling antimeridian cases for global-scale operations

## Architecture

### Key Components

- **Hono Framework**: Used for routing and request handling
- **overlay-engine**: Core spatial operations library that provides:

  - `prepareSketch`: Prepares geometries for clipping operations
  - `clipToGeography`: Clips geometries against geographic boundaries
  - `unionAtAntimeridian`: Handles geometries that cross the antimeridian
  - `clipSketchToPolygons`: Performs the actual clipping operations

- **fgb-source**: Manages efficient access to FlatGeobuf data:

  - `SourceCache`: Caches source data to improve performance
  - Handles range requests for efficient data streaming

- **Cloudflare R2**: Stores geographic data in FlatGeobuf format
  - Data is accessed via range requests for efficient streaming
  - Implements caching to reduce R2 access frequency

### Data Flow

1. Client sends a sketch geometry and target Geographies
2. Worker prepares the sketch for processing
3. For each Geography:
   - Retrieves necessary data from R2 (cached when possible)
   - Performs clipping operations
   - Handles antimeridian cases if needed
4. Returns the largest valid result

## Dependencies

- `@hono/zod-validator`: Request validation
- `@turf/area`: Area calculations
- `fgb-source`: FlatGeobuf data access
- `hono`: Web framework
- `overlay-engine`: Spatial operations
- `zod`: Schema validation
- `zod-geojson`: GeoJSON validation

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Generate Cloudflare types
npm run cf-typegen
```

## Deployment

```bash
# Deploy to Cloudflare
npm run deploy
```

### Required Bindings

The worker requires the following Cloudflare bindings:

- `SSN_TILES`: R2 bucket containing geographic data in FlatGeobuf format

### Environment Variables

- `DEV`: Set to true for local development (uses HTTPS instead of R2)

## API Reference

### POST /clip

Clips a sketch geometry against one or more Geographies. Each Geography can have multiple clipping layers that define its boundary. The operation can either intersect (keep only the overlapping area) or difference (remove the overlapping area) the sketch against each Geography's boundary.

**Request Body:**

```typescript
{
  feature: GeoJSONFeature,
  geographies: Array<{
    id: number,
    name: string,
    clippingLayers: Array<{
      id: number,
      op: "INTERSECT" | "DIFFERENCE",
      templateId?: string | null,
      cql2Query?: any,
      dataset: string
    }>
  }>
}
```

**Response:**

```typescript
{
  success: boolean,
  data?: GeoJSONFeature,
  error?: string
}
```

### POST /warm-cache

Pre-warms the cache for upcoming clipping operations. This endpoint is called by the SeaSketch client as users are drawing sketches, ensuring that the necessary geographic data is cached and ready for the final clipping operation.

**Request Body:** Same as /clip endpoint

**Response:**

```typescript
{
  success: boolean;
}
```

## Performance Considerations

- The worker implements caching at multiple levels:
  - R2 range request caching
  - In-flight request deduplication
  - Source data caching via `SourceCache`
- Parallel processing of multiple Geographies
- Efficient range-based data streaming from R2
- Pre-warming cache for better user experience

## Error Handling

The worker implements comprehensive error handling:

- Input validation using Zod schemas
- Graceful handling of missing intersections
- Proper error responses with meaningful messages
- Logging of errors for debugging
