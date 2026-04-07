# `gl-style-builder`

Build Mapbox GL style layers from `@seasketch/geostats-types` metadata and optional `ai-data-analyst` notes, for use with SeaSketch’s cartography tools.

## Build

```bash
npm run build    # tsc → dist/lib/
npm run watch    # tsc -w
npm test         # vitest
```

Composite TypeScript project: depends on `../geostats-types` and `../ai-data-analyst` via **project references**, so consumers can run **`tsc -b`** and have those built first.

## Consumer `tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true
  },
  "references": [
    { "path": "../geostats-types" },
    { "path": "../ai-data-analyst" },
    { "path": "../gl-style-builder" }
  ]
}
```

Then import:

```ts
import { buildGlStyle, type BuildGlStyleInput } from "gl-style-builder";
```

Package entry: **`main`** / **`types`** → `dist/lib/index.js` and `dist/lib/index.d.ts` (publish or build before use).
