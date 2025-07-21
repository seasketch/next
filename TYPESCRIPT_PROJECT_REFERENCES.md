# TypeScript Project References Setup

This monorepo has been updated to use TypeScript project references, which allows for faster incremental compilation and better dependency management.

## What Changed

### 1. API Package (`packages/api`)

- Updated `tsconfig.json` to use project references
- Added references to all dependent packages
- Updated build script to use `tsc -b` (build mode)
- Added `build:watch` script for watch mode

### 2. Dependent Packages

All packages that the API depends on have been updated to support project references:

- `geostats-types`
- `map-tile-cache-calculator`
- `mapbox-gl-esri-sources`
- `metadata-parser`
- `overlay-engine`
- `spatial-uploads-handler`
- `vector-data-source`
- `fgb-source`

Each package now has:

- `composite: true` in tsconfig.json
- `incremental: true` for faster builds
- `declarationMap: true` and `sourceMap: true` for better debugging
- Updated `package.json` to point to source TypeScript files instead of built files

### 3. Root Configuration

- Added root `tsconfig.json` that references all packages
- This allows building the entire monorepo with a single command

## How to Use

### Building the API

```bash
# Build once
cd packages/api
npm run build

# Build in watch mode (recommended for development)
npm run build:watch
```

### Building the entire monorepo

```bash
# From the root directory
tsc -b
```

### Development Workflow

1. Start the API in watch mode: `cd packages/api && npm run build:watch`
2. Make changes to any source files in any package
3. TypeScript will automatically detect changes and rebuild only what's necessary
4. No need to run separate build processes for each package

## Benefits

1. **Faster Builds**: Only changed files and their dependencies are recompiled
2. **Better Dependency Management**: TypeScript understands the dependency graph
3. **Single Watch Process**: One command watches all packages
4. **Type Safety**: Better type checking across package boundaries
5. **Incremental Compilation**: Build information is cached for faster subsequent builds

## File Structure

```
packages/
├── api/
│   ├── tsconfig.json          # References all dependent packages
│   └── package.json           # Updated build scripts
├── geostats-types/
│   ├── tsconfig.json          # Composite project
│   └── package.json           # Points to source files
├── map-tile-cache-calculator/
│   ├── tsconfig.json          # Composite project
│   └── package.json           # Points to source files
└── ... (other packages)
```

## Troubleshooting

If you encounter build errors:

1. Clean all build artifacts:

   ```bash
   find . -name ".tsbuildinfo" -delete
   find . -name "dist" -type d -exec rm -rf {} +
   ```

2. Rebuild from scratch:
   ```bash
   cd packages/api
   npm run build
   ```

## Next Steps

This setup focuses on the API package. The client package can be updated similarly in the future to use project references as well.
