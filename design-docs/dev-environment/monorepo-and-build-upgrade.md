# Monorepo and build system

> Part of the [2026 campaign record](README.md). Status: design, started September 2026.

[Index](README.md) · [Strategy](strategy.md)

## Intent

The repo behaves like one TypeScript product: one install, shared dependency versions, one Node and one TypeScript unless a package writes down why it differs, and a client build fast enough to test thoroughly in CI and light enough that the editor stays usable.

Three changes get there, in three separate pull requests across two phases of the [strategy](strategy.md): Node LTS and npm workspaces in phase 2, and replacing Create React App in phase 4. Combining any two would make a failure impossible to attribute.

## Starting point (2026)

**Packaging.** Lerna 6.6.2 in independent mode, with an explicit `packages` list in `lerna.json`. The root `package.json` has no workspaces and no scripts. There are roughly thirty `package-lock.json` files. Installs are a different `lerna bootstrap --scope=…` list in each place:

- each CI job (API tests, schema drift, generated CSS, client tests, client build, overlay-engine) and the client preview;
- the deploy workflow (`--scope=infra` for the server, `--scope=client` for the client), which also installs `typescript@5.5.3` globally;
- the production GraphQL image (`packages/infra/containers/graphql/Dockerfile`), which clones the repo at a commit and bootstraps a hand-maintained list of twelve scopes;
- CDK `NodejsFunction` Lambdas, where the overlay worker and fragment worker bundle against their own package's lockfile;
- Docker-image Lambdas (spatial uploads, data tables, subdivision, PII classifier). The spatial-uploads image rebuilds internal packages from their individual lockfiles and deletes `@seasketch/*` dependencies from `package.json` with `jq` before installing.

Several packages are outside Lerna on purpose or by drift. `data-tables-handler` says it is omitted to keep CI bootstrap small. `pmtiles-server` and other Workers are not listed. `packages/client/graphql-validate` is a deliberately isolated package the deploy gate installs on its own. Internal dependencies are mostly version ranges on `@seasketch/*`, with a few `file:../…` links.

**Toolchain.** `.nvmrc` and the production GraphQL image use Node 23, which reached end of life in June 2025. CDK Lambdas target Node 22; the spatial-uploads image uses a Node 20 base. TypeScript is mostly 5.5, with the API and root on 5.8 and `pmtiles-server` on 7. Nothing declares `engines`. Root ESLint is version 7 with `@typescript-eslint` 4.

**Build output.** `dist/` is gitignored for the API and client but committed for `overlay-engine`, `fgb-source`, `metadata-parser`, `geostats-types`, and `data-tables-handler`. Generated *sources* that CI checks are a separate, healthy category: `generated-schema.gql` against `generated-schema-clean.gql`, `src/generated/graphql.ts`, and Tailwind's `src/index.css`.

**Client.** Create React App via `react-scripts` 4.0.3. The production build needs `NODE_OPTIONS=--openssl-legacy-provider`. ESLint extends CRA's `react-app` configuration plus the Cypress plugin. Client tests run under CRA's Jest. GraphQL codegen extracts operations with an older Babel parser, which is why [`AGENTS.md`](../../AGENTS.md) forbids `import type` in client code. Environment variables are `REACT_APP_*`, baked in at build time.

Other packages build to match their runtime: `tsc -b` for the API, esbuild through CDK for Node Lambdas, Wrangler for Workers, Docker for native-heavy Lambdas. That variety is legitimate. What is missing is shared versions, one install, and the same script names.

## Phase 2a — Node Active LTS

One pull request, and its own production deploy. Pick the current Active LTS, then set it in `.nvmrc`, `engines`, CI, the production GraphQL image, CDK Lambda `runtime` and `target`, and the Docker Lambda base images. A native dependency that cannot run on that LTS is recorded under *Decisions* as a named exception.

This goes first because it changes the production runtime, and because packaging changes are easier to debug on a single Node version.

## Phase 2b — npm workspaces

**Workspaces replace Lerna.** The root `package.json` declares the workspaces with a glob, not a second hand-kept list. One root lockfile replaces the per-package ones as each package joins. A package may stay outside only with a written reason that is not "to keep installs small." `graphql-validate` is the model: it runs against the live schema with only `graphql` installed, on purpose.

**Internal dependencies.** npm links a workspace package whenever its version satisfies the dependent's range. npm does not support the `workspace:` protocol (pnpm and Yarn do). Internal dependencies use a range the local version satisfies, and the existing `file:` links convert to ranges. Consumers compile against workspace source or the workspace's build output, never against a committed `dist/` that can drift.

**Shared versions.** Application packages share one TypeScript version. Where two packages need different majors of a library (the API and client use different `@mapbox/mapbox-gl-style-spec` majors today), npm nests the second copy, and that is acceptable. Type packages are the exception to watch: duplicated `@types/react` or conflicting `@types/jest` versions are the usual hoisting failure. Resolve them with root-level versions or `overrides`.

**Production build paths.** These are part of phase 2b, not follow-ups, because they break once per-package lockfiles are gone:

- The deploy workflow and every CI job install with `npm ci` at the root, optionally filtered with `--workspace`.
- The GraphQL image installs the workspace and builds the API and its dependencies. It no longer lists scopes.
- `NodejsFunction` bundling points `depsLockFilePath` at the root lockfile, or at a pruned lockfile generated for the bundle.
- Docker Lambdas build from a context that includes the root lockfile and the workspace packages they need, replacing the per-package vendoring and `jq` editing in the spatial-uploads image. If a native-heavy image is better left self-contained, it stays outside the workspace with that reason written down.

The first deploy after 2b lands contains no product changes. The post-deploy `@production` probe from [integration testing](integration-testing.md) confirms it.

**Script names.** A package that builds exposes `build`; one that tests exposes `test`; one that runs locally exposes `dev`. Root scripts are the [environment contract](env-setup.md) plus a `test` aggregate. Packages may add other scripts, but not a private name for what everyone else calls `build`.

**Build output policy.**

| Kind | Examples | Policy |
| --- | --- | --- |
| Compiler output | `dist/`, CRA `build/`, esbuild bundles | Gitignored. Produced by `build`. CI builds what it tests |
| Reviewed generated source | GraphQL schema, `src/generated/graphql.ts`, `src/index.css` | Committed. Existing drift jobs remain the gate |
| Committed `dist/` today | `overlay-engine`, `fgb-source`, `metadata-parser`, `geostats-types`, `data-tables-handler` | Each either gets a written reason next to the package (and CI rebuilds and diffs it), or becomes gitignored output |

No new package commits `dist/`.

**Editor relief without a new bundler.** TypeScript project references so shared packages and the API are not checked as one flat program, and ESLint caching. The CRA dev server stays heavy until phase 4.

## Phase 4 — replacing Create React App

CRA blocks a modern client: the legacy OpenSSL build, a slow dev server, Jest pinned by `react-scripts`, ESLint tied to `eslint-config-react-app`, and pressure on imported packages to stay CRA-compatible.

**Vite is the candidate**, not a commitment made before a spike. The spike succeeds when all of the following hold with phase 3's journeys already green on CRA:

- The dev server hot-reloads and proxies the local GraphQL API.
- The production build runs without `--openssl-legacy-provider` and produces the static assets the preview and deploy workflows publish, including the source maps the Sentry release step uploads.
- Client unit tests run under Vitest, or Jest with a Vite-compatible transform, without rewriting assertions.
- ESLint runs on a current major with its own configuration, keeping the `i18next/no-literal-string` rule the client depends on.
- GraphQL codegen and Tailwind still fit the dev loop. Codegen is a watcher or pre-step, not something Vite replaces. If the codegen parser is upgraded along the way, the `import type` ban in `AGENTS.md` can be lifted; if not, it stays.
- Mapbox GL, the `@mapbox/mapbox-gl-draw` fork, web workers, and other webpack-sensitive dependencies work, or have a specific alias or plugin fix.
- `REACT_APP_*` is renamed in one pass from the [secrets manifest](secrets-management.md).

If the spike fails on a dependency that cannot be wrapped, record the blocker in *Decisions* and try the next candidate against the same list. We do not stay on CRA because the migration was inconvenient, and we do not switch bundlers in a pull request that also moves packages.

The journeys are the acceptance test. They do not import `react-scripts`, so they carry over unchanged. Before the first production deploy, the client preview workflow publishes the new build to a real host.

Workers, Lambda containers, and CDK's esbuild keep their build tools. "Consistent builds" means shared versions, one install, and standard script names, not one compiler everywhere.

## Decisions

- Node LTS, workspaces, and the client bundler are three pull requests with separate deploys, in that order.
- *(October 2026)* Node 24. It is the Active LTS that Lambda runs in production; Node 26 is still a Lambda public preview. No native dependency forced an older Node. Subdivision and the PII classifier stay on their Python images. Lambdas that imported `aws-sdk` from the Node 14 runtime now call SDK v3, which Node 24 includes. The phase 2a exit stays open until this runtime is deployed and the production probe passes.
- npm workspaces. No Nx, Turborepo, or new Lerna. Task caching may be reconsidered after phase 4 if CI is still slow. *(October 2026)* The root `package.json` `workspaces` field is `packages/*`. `npm run bootstrap` is `npm install`. CI and the deploy workflow run `npm ci` at the root.
- *(October 2026)* Every CI job and the local install use a full root `npm ci` / `npm install`. One cache key, `package-lock.json`. On npm 11, `npm ci --workspace` still installs every workspace's production dependencies, so it does not shrink an image. Production images copy only the workspace packages they compile and run `npm install` against the root lockfile. Missing workspaces make `npm ci` refuse the lockfile; `npm install` keeps the locked versions for the packages that are present.
- *(October 2026)* Internal dependencies are version ranges the local version satisfies. The `file:` links in `pmtiles-server` and `data-library-gmw` are ranges.
- *(October 2026)* Application packages use TypeScript 5.8.3. `pmtiles-server` aligns with that version: its typecheck reports the same diagnostics on 5.8 and 7, and Wrangler bundles with esbuild, so the TypeScript 7 pin was not required. `@types/jest` stays nested (the client is still on Create React App's Jest 26, the API suite on an older Jest, other packages on Jest 29). Forcing one `@types/jest` would typecheck the client against the wrong Jest. `@types/react` is only declared by the client. The API and the client keep their different `@mapbox/mapbox-gl-style-spec` majors, nested by npm. Root `overrides` keep the unified tree on the versions this source already typechecks against: `@types/express` 4.17.25 and `@types/express-serve-static-core` 4.19.9 (Express 4 types; a bare install selects the Express 5 types), `@types/mapbox-gl` 3.1.0, and `mapbox-gl` 3.4.0 (the client's exact pin; the API previously locked 3.3.0). Every package's `aws-sdk` v2 range is satisfied by one copy. The survey invite calls pass `DefaultTemplateData: "{}"` because that field is required on the resolved SDK types; destinations still supply their own replacement tags. `overlay-worker` keeps `pbf` 4, and its geobuf decode call casts that instance to the `pbf` 3 type `@types/geobuf` resolves from the hoisted copy. Express 4 query values are `string | ParsedQs`, so the API handlers that read tokens narrow them to strings. `bytes` can return null, and the upload size limits coerce that to a number. `@types/bytes` stays on 3.1.2 so the client's `bytes()` calls stay typed as strings. The first workspace install floated packages the separate lockfiles had pinned, and Jest and webpack still aliased `polyclip-ts` and `splaytree-ts` into `overlay-engine/node_modules`, which npm no longer creates. Those aliases use the hoisted CJS build, or a nested copy when one is present. `overlay-engine` depends on `lru-cache` 11 so its range reader does not load the hoisted v7. Further root devDependencies, with matching overrides, pin `browserslist` to 4.24.4 and `caniuse-lite` to 1.0.30001695 (the client lock Tailwind was generated with) and `@radix-ui/react-use-controllable-state` to 1.2.2, `@radix-ui/react-context-menu` to 2.1.5, and `@radix-ui/react-scroll-area` to 1.0.5 (webpack 4 cannot resolve the `is-development` export those newer releases import). The development server is the other webpack 4 constraint: its browserslist targets are current browsers, so Babel leaves class fields and static blocks in place and webpack 4's parser rejects them (the production build transpiles them). Overrides therefore hold `@radix-ui/react-accordion` at 1.1.2, `react-dropdown-menu` at 2.0.6, `react-menubar` at 1.0.4, `react-radio-group` at 1.3.8, `react-select` at 2.0.0, `react-slider` at 1.1.2, and `react-toggle-group` at 1.1.0 (the client lock's versions; later releases depend on `@radix-ui/react-collection` 1.2.0, which uses a static block), and the client pins `sql.js` 1.8.0 (1.15 ships class fields). `@tailwindcss/forms` stays on 0.5.10 and `@tailwindcss/typography` on 0.5.16. The root depends on `graphql` 15.8.0, the client's previous lock, so Apollo and `graphql-codegen` share that copy and the generated hooks stay in the committed order. The API depends on `graphql` 14.6.0, nested under `packages/api`, and PostGraphile resolves that same copy. That is the GraphQL `lexicographicSortSchema` uses when checking schema drift. The report tab node view accepts the selection mutation record current `prosemirror-view` passes to `ignoreMutation`. TypeScript 5.8 types `Set` iterator values as possibly undefined, and the legend compiler skips that case. `slonik` is kept on `pg` 8.5.1. The API depends on `pg` 8.3.0, `postgraphile` 4.14.0, `graphile-utils` 4.14.0, `@graphile-contrib/pg-simplify-inflector` 6.0.0, `slonik` 23.0.2, `slonik-sql-tag-raw` 1.0.2, and `mockdate` 3.0.2. `sanitize-html` stays on 2.11.0 so the client build does not pick up an `htmlparser2` that imports the `entities/decode` subpath webpack 4 cannot resolve. The API Jest resolver and the client webpack config rewrite `node:` built-ins, which current AWS SDK and `sql.js` packages import and which Jest 26 and webpack 4 treat as files. The client production build gives Node a 4 GB heap; webpack 4 exceeds the default limit while optimizing this bundle.
- *(October 2026)* Compiler `dist/` is gitignored. `npm run build:libs` builds the libraries in dependency order, including `overlay-worker` because the API imports its declarations, then the API build is `tsc -b`. Nothing commits `dist/`. `@seasketch/data-library-gmw`'s `build` script is the data-library job, not compiler output, and it is not part of `build:libs`.
- *(October 2026)* Docker images. `spatial-uploads-handler` and `data-tables-handler` build from the repo root with the root lockfile and `--omit=dev`. Subdivision and the PII classifier stay outside the workspace because they are Python images. The database migration image and the maintenance container stay self-contained: they install a few named packages and do not compile workspace TypeScript. `packages/client/graphql-validate` keeps its own lockfile so the deploy gate resolves `graphql@15.3.0` only. `packages/infra/lambdas/dataHostDbUpdater` and `dataHostingStackHook` stay outside because CDK zips those directories and their `node_modules` have to be inside the zip.
- *(October 2026)* `NodejsFunction` bundling. Functions that set `nodeModules` use a pruned `bundle-package-lock.json` generated by `scripts/write-lambda-bundle-lockfiles.mjs`. CDK writes a synthetic package.json of those modules and runs `npm ci`, which a workspace lockfile does not satisfy. Functions that only bundle with esbuild set `projectRoot` to the repo root and `depsLockFilePath` to the root lockfile.
- Client environment variable names change once, with the bundler.

## Open questions

- *(After phase 4)* Whether to move application packages to TypeScript 7's native compiler for faster checks in CI and the editor. It is the most direct fix for typecheck cost, but it depends on tools that use TypeScript's JavaScript API — `@typescript-eslint`, codegen, and CRA's type checker until phase 4 removes it — supporting it. Record the outcome here even if it is "not yet."
- *(Phase 4)* Vite or the recorded fallback; Vitest or Jest; how the Cloudflare preview and deploy steps upload the new build output.

## Exit criteria

- **Phase 2a:** One Node Active LTS across local, CI, the GraphQL image, and Lambdas, deployed to production, with the probe passing.
- **Phase 2b:** Lerna is gone. There is one root lockfile, with every exception named here. CI and deploy install from the root. The GraphQL image and Lambda bundles build from the workspace. Smoke is green and its install step is materially shorter. A no-product-change deploy passes the production probe. *Install, lockfile, and build paths landed October 2026. The smoke job's install is one root `npm ci`. The production probe is the deploy workflow's check on the first deploy of this change.*
- **Phase 4:** CRA and `--openssl-legacy-provider` are gone. Phase 1 and phase 3 journeys pass on the new dev server and production build. ESLint and client tests no longer depend on CRA. The client CI build and dev-server startup are materially faster. The preview and deploy workflows publish the new output.
