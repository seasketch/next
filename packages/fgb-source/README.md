# fgb-source

A TypeScript library for efficiently reading and querying FlatGeobuf (FGB) files. This library provides a client-side implementation optimized for web environments and edge computing platforms like Cloudflare Workers.

## Why fgb-source?

I implemented this custom client because I was disatisfied with how the canonical implementation was packaged for npm, and the lack of control it gave over how data is fetched and cached. fgb-source is specifically designed for web and edge computing environments with these key features:

- **Memory Efficiency**: Features are streamed and parsed individually, minimizing memory usage in constrained environments
- **Network Optimization**: Built-in LRU caching and request batching to minimize network requests
- **Edge Computing Ready**: Designed to work efficiently in edge environments like Cloudflare Workers
- **TypeScript First**: Full TypeScript support with comprehensive type definitions
- **Designed for repeated queries**: Clients create a source which parses the index once and uses that data to issue repeated bounding box queries

## Installation

```bash
npm install fgb-source
```

## Basic Usage

```typescript
import { createSource } from "fgb-source";

// Create a source from a URL
const source = await createSource("https://example.com/data.fgb");

// Query features within a bounding box
const bbox = { minX: -180, minY: -90, maxX: 180, maxY: 90 };
for await (const feature of source.getFeaturesAsync(bbox)) {
  console.log(feature);
}

// Use with Cloudflare R2
const source = await createSource("r2://my-bucket/data.fgb", {
  fetchRangeFn: async (key, range) => {
    // key will be "r2://my-bucket/data.fgb"
    const [bucket, objectKey] = key.replace("r2://", "").split("/", 2);
    const r2Object = await env.MY_BUCKET.get(objectKey, {
      range: {
        offset: range[0],
        length: range[1] ? range[1] - range[0] + 1 : undefined,
      },
    });
    if (!r2Object) throw new Error("Object not found");
    return r2Object.arrayBuffer();
  },
});
```

## API Reference

### `createSource(urlOrKey: string, options?: CreateSourceOptions)`

Creates a new FlatGeobufSource instance.

#### Parameters

- `urlOrKey`: URL or key to the FGB file. When using a custom fetch function, this key is passed to the function to identify the source data. The format of the key is up to you - it could be a URL, an R2 object key, or any other identifier that makes sense for your use case.
- `options`: Optional configuration
  - `fetchRangeFn`: Custom function for fetching byte ranges. The function receives the key and a range tuple [start, end] and should return a Promise resolving to an ArrayBuffer.
  - `maxCacheSize`: Maximum size of the feature data cache (default: 5MB)

### `FlatGeobufSource`

Main class for working with FGB files.

#### Methods

- `getFeaturesAsync(bbox: Envelope | Envelope[]): AsyncGenerator<FeatureWithMetadata<T>>`
  - Streams features within the specified bounding box
- `scanAllFeatures(): AsyncGenerator<FeatureWithMetadata<T>>`
  - Streams all features in the file
- `getFeatureProperties(): AsyncGenerator<{ properties: GeoJsonProperties }>`
  - Streams feature properties only
- `clearCache(): void`
  - Clears the feature data cache

#### Properties

- `bounds`: Bounding box of the entire dataset
- `geometryType`: Geometry type of the features
- `indexSizeBytes`: Size of the spatial index in bytes
