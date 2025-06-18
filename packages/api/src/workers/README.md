# Polygon Clipping Worker Threads

This directory contains a Node.js worker thread implementation for handling CPU-intensive polygon clipping operations without blocking the main event loop.

## Overview

The `clipSketchToPolygons` function from the `overlay-engine` package can take 100ms or more to complete complex polygon clipping operations, which can block the Node.js event loop and impact server responsiveness. This worker thread implementation offloads these operations to a separate thread.

## Files

- `clippingWorker.ts` - The worker thread that performs polygon clipping operations
- `clippingWorkerManager.ts` - Manager class that handles communication with the worker thread

## How it works

1. **Worker Thread**: The `clippingWorker.ts` file runs in a separate Node.js thread and handles the actual polygon clipping operations using the `polygon-clipping` library.

2. **Manager**: The `clippingWorkerManager.ts` provides a singleton instance that manages the worker thread lifecycle and communication.

3. **Timeout Protection**: Operations have a 8-second timeout to prevent hanging workers.

## Usage

The worker is automatically used in the `sketchingPlugin.ts` when calling `clipToGeography`. The plugin now uses:

```typescript
const clipped = await clippingWorkerManager.clipSketchToPolygonsWithWorker(feature, op, cql2Query, source.getFeaturesAsync(feature.envelopes));
```

Instead of the previous blocking call:

```typescript
const clipped = await clipSketchToPolygons(feature, op, cql2Query, source.getFeaturesAsync(feature.envelopes));
```

## Benefits

- **Non-blocking**: Main event loop remains responsive during polygon clipping
- **Automatic**: No code changes needed in calling functions
- **Robust**: Includes timeout protection and error handling
- **Clean**: Automatically terminates workers on process exit

## Performance Considerations

- **Memory**: Each worker thread has its own memory space.
- **Concurrency**: Currently uses a single worker thread. For high concurrency, consider a worker pool

## Future Improvements

- **Worker Pool**: Implement a pool of worker threads for handling multiple concurrent operations
- **Streaming**: Support streaming large polygon datasets instead of loading them all into memory
- **Metrics**: Add performance metrics to track worker thread usage and effectiveness
