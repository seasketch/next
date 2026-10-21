# Monorepo and build system

> Part of the [2026 campaign record](README.md). Status: design, started September 2026.

[Index](README.md) · [Strategy](strategy.md)

## Intent

The repo behaves like one TypeScript product: one install, shared dependency versions, one Node and one TypeScript unless a package writes down why it differs, and a client build fast enough to test thoroughly in CI and light enough that the editor stays usable.

Three changes get there, in three separate pull requests across two phases of the [strategy](strategy.md): Node LTS and npm workspaces in phase 2, and replacing Create React App in phase 4. Combining any two would make a failure impossible to attribute. *(October 2026)* The workspaces pull request also carries dependency consolidation and TypeScript project references, because those are the same axis — what resolves, and what builds — and a second lockfile rewrite would conflict with everything that lands in between.

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

### Dependency consolidation

*(October 2026)* The first workspace install showed what thirty lockfiles had been hiding: three `graphql` copies, three React copies, five `vitest` ranges, eight `@types/node` majors, two or three copies of ProseMirror, Apollo, `@types/pg`, and `pg`, and 847 package names with more than one version in the tree. The 2b pull request pinned most of these back to what the separate lockfiles had resolved, so that CI would pass without product changes. That made the tree stable, not consolidated. Consolidation is the next step in the same pull request, and it is allowed to change dependency versions and regenerate committed artifacts, within these limits:

- Same major version. A dependency moves to the newest release of the major it is on today. A major bump is its own later change.
- The API test suite, schema drift, client codegen, the client typecheck, and the smoke journeys are the acceptance tests. A generated artifact may change; the diff is read, and anything that is not printer or ordering noise is explained in the pull request.
- Create React App's constraints stay. Pins that exist only because webpack 4 or Jest 26 cannot load a package are kept and listed under *Pins carried into phase 4* below, not fought.

**Steps, in order.** Each is one commit on the 2b branch.

1. **One GraphQL.** The root and `packages/api` depend on the same `graphql` 15.x. The nested `packages/api/node_modules/graphql` lock node is removed so PostGraphile, graphile-build, Apollo, and `graphql-codegen` resolve one copy. `@types/graphql` is removed; `graphql` ships its own types. PostGraphile 4.14 and its plugins accept 15; the one stale peer range is `@graphile/postgis` 0.1.0 (`<15`), which is recorded, not obeyed. The graphile family moves to the newest 4.14.x (`postgraphile`, `postgraphile-core`, `graphile-build`, `graphile-build-pg`, `graphile-utils`, `@graphile/pg-pubsub`), `@graphile-contrib/pg-simplify-inflector` to the newest 6.x, `pg-many-to-many` and `pg-order-by-related` to their newest 1.0.x. `graphile-worker` stays on 0.13 (0.x releases are majors).
2. **Regenerate the schema and the client.** Print `generated-schema.gql` from a freshly migrated shadow database (`npm run db:migrate -- --shadow`, then the print script, as the drift job does), regenerate `generated-schema-clean.gql`, run the client's `graphql:codegen`, and commit. GraphQL 15's printer reorders some members and rewraps descriptions; that is the expected noise. Any other difference comes from an inflector or plugin bump and is named in the pull request. `npm run db:drift` and the client typecheck pass on the result.
3. **One `pg`.** The API moves from `pg` 8.3 to the newest 8.x, `slonik` to the newest 23.x, and the `slonik` → `pg` 8.5.1 override is removed. `@types/pg` is one version across the API, `graphile-worker`, `lambda-db-client`, `infra`, `data-tables-handler`, and `spatial-uploads-handler`, so `PoolClient` is one type. The API suite and the Lambda typechecks are the test.
4. **One copy of each shared library.** For each package that two or more workspaces import directly, every manifest declares the same version, and the lock holds one copy at the root. The known cases are `prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-transform`, and `prosemirror-commands` (API and client), `@apollo/client` (client and the `@types/apollo-upload-client` stub), `@lezer/common`, `lru-cache`, `colord`, `nanoid`, `slugify`, `h3-js`, `pbf`, and `@turf/*` (7.x everywhere; `vector-data-source` and the client's `@turf/area` leave 6.5). Where the client and API typecheck against different versions today, the newer of the two within the same major is chosen, and the compile errors are fixed in source. Type packages follow the same rule: one `@types/react`, one `@types/react-dom`, one `@types/node` for Node 24 wherever a package's typecheck allows it. `@types/jest` stays nested, as already decided.
5. **One range per tool.** `vitest` is one range in every package that uses it (`pmtiles-server` may hold a newer major with a reason). `esbuild` is one range in the libraries and Lambdas; the client's 0.14 copy belongs to its CRA-era scripts and is listed as a carried pin. `wrangler` and `@cloudflare/workers-types` are one range across the Workers. `@aws-sdk/*` is one range across the API and Lambdas. Every `test` script runs once and exits: `vitest run`, never bare `vitest`; `tsx` is a root devDependency, not an `npx --yes` fetch at test time.
6. **Regenerate Tailwind.** The `browserslist` and `caniuse-lite` pins and their root devDependencies are removed, `npm run css:build` regenerates `src/index.css`, and the result is committed. `npm run css:check` passes on the result.
7. **Peer dependencies.** With the tree consolidated, `legacy-peer-deps=true` is removed from `.npmrc` if `npm install` then succeeds; if a peer conflict remains, the conflicting package and its range are recorded under *Pins carried into phase 4* and the flag stays with that reason.
8. **Record what remains.** Every surviving entry in root `overrides` is either in the table below with its reason and removal phase, or is deleted.

### TypeScript project references

*(October 2026)* Root `tsconfig.json` already references thirteen packages, and most libraries set `composite: true`, but almost none declare `references` of their own, so `tsc -b` of one package does not know its workspace dependencies. The 2b pull request makes `tsc -b <package>` build exactly that package's transitive workspace dependencies and nothing else:

- Every composite package declares `references` matching its `@seasketch/*` and other workspace dependencies, and sets `types` so consumers resolve declarations from `dist/`. `fgb-source` gets a composite `tsconfig.json`; its `tsup` build either moves to `tsc` or stays as a publish step that is not on the API's path.
- `vector-data-source` and `map-tile-cache-calculator` point `main` at their `tsc` output. The esbuild bundle they produce exists for Lambda packaging and moves to the CDK `NodejsFunction` that consumes it, or stays as a script no library consumer depends on. `mapbox-gl-esri-sources` keeps its Rollup browser build; the API consumes the `tsc` output. `overlay-engine`'s `build:worker` is the one bundler step that stays on the API's path until its consumer is moved to CDK.
- `npm run build --workspace=@seasketch/api` is `tsc -b` and builds only the API's references. `scripts/build-libs.mjs` shrinks to the steps `tsc -b` cannot run, or is deleted. CI jobs and the GraphQL image build the target they test (`tsc -b packages/api`, `tsc -b packages/spatial-uploads-handler`) instead of running `build:libs` first. `npm test --workspace=overlay-engine` needs no build; Vitest reads the sources.
- Builds are incremental: `.tsbuildinfo` files are gitignored and the second `tsc -b` of an unchanged package is a no-op.
- *(October 2026)* The tsconfigs become TypeScript 7-ready while staying on 5.8. TypeScript 7's native compiler removes `moduleResolution: node` (node10) and `target: ES5`; twenty packages use the first and three the second. CommonJS Node packages move to `module` and `moduleResolution` `node16`; Workers and esbuild-bundled packages move to `bundler`; ES5 targets become ES2020 or later. The handful of errors those modes surface (CommonJS default imports of `@turf/*`, `pmtiles` resolving its ESM types, relative dynamic `import()` calls needing `.js`) are fixed in source. TypeScript 5.8 accepts all of it, so nothing else changes now. The upgrade itself waits for phase 4: `typescript@7` ships no JavaScript compiler API, and `fork-ts-checker` (Create React App), `@typescript-eslint` (latest accepts `<6.1`), `ts-jest` (`<7`), and `ts-node` all link against that API. Measured on this tree, `tsgo` checks the API in about one second against five for `tsc` 5.8; the client, which is the slow program, cannot move until CRA is gone.

### Pins carried into phase 4

*(October 2026)* These exist because `react-scripts` 4 (webpack 4, Jest 26, Babel with the development browserslist) cannot load the current release. They are temporary. The phase 4 pull request deletes each one and records the deletion here.

| Pin | Where | Reason | Removed by |
| --- | --- | --- | --- |
| `@radix-ui/react-context-menu` 2.1.5, `react-scroll-area` 1.0.5, `react-use-controllable-state` 1.2.2 | root `overrides` | webpack 4 cannot resolve the `is-development` package export | phase 4 |
| `@radix-ui/react-accordion` 1.1.2, `react-dropdown-menu` 2.0.6, `react-menubar` 1.0.4, `react-radio-group` 1.3.8, `react-select` 2.0.0, `react-slider` 1.1.2, `react-toggle-group` 1.1.0 | root `overrides` | later releases pull `react-collection` 1.2.0, whose class static block the dev server's webpack 4 cannot parse | phase 4 |
| `sql.js` 1.8.0 | client | 1.15 ships class fields the dev server cannot parse | phase 4 |
| `sanitize-html` 2.11.0 | client and API | newer `htmlparser2` imports the `entities/decode` subpath webpack 4 cannot resolve | phase 4 |
| `@types/bytes` 3.1.2 | root `overrides` | keeps the client's `bytes()` calls typed as strings under Jest 26 types | phase 4 |
| `node:` scheme rewrites | `craco.config.js`, `packages/api/tests/jestNodeResolver.js` | webpack 4 and Jest 26 treat `node:fs` as a file path | phase 4 (client); API when its Jest moves off 26 |
| `polyclip-ts` / `splaytree-ts` CJS aliases | `craco.config.js`, `packages/api/jest.config.js` | webpack 4 and Jest 26 cannot load the ESM build | phase 4 (client); API with its Jest |
| `esbuild` ^0.14 | client | CRA-era client scripts | phase 4 |
| `--openssl-legacy-provider`, `--max-old-space-size=4096` | client scripts | webpack 4 | phase 4 |
| `@types/jest` nested per package | client, API | Jest 26 in the client, Jest 26 in the API, Jest 29 elsewhere | phase 4 (client); API with its Jest |

Not temporary, and kept with their reasons: `@types/express` 4.17.25 and `@types/express-serve-static-core` 4.19.9 (Express 4), `@types/mapbox-gl` 3.1.0 and `mapbox-gl` 3.4.0 (the client's exact pin), and `graphql-validate`'s own lockfile.

### Completion checkpoints for the phase 2b pull request

*(October 2026)* The pull request is finished when all of these hold. Each is checked on the branch head, not on an earlier commit.

1. `npm ci` from a clean `node_modules` exits 0 without `legacy-peer-deps`, or with that flag and a named remaining conflict in the table above.
2. `npm ls graphql`, `npm ls pg`, `npm ls @types/pg`, `npm ls prosemirror-model`, `npm ls @apollo/client`, and `npm ls react` each report one version, with the exceptions named in *Decisions*.
3. Root `overrides` contains only entries in the *Pins carried into phase 4* table or the not-temporary list.
4. `npm run db:drift` exits 0, and the regenerated schema and `src/generated/` are committed with the diff explained.
5. `tsc -b packages/api` builds the API and only its references from a clean tree; running it again is a no-op. `npm run build:libs` is gone or lists only non-`tsc` steps.
6. Every CI job in `unit-tests.yml` builds only the target it tests. The API job's build step is not slower than it was under Lerna (14 seconds on master in October 2026; 42–44 seconds after the first workspace commit).
7. All seven checks are green: client build, client tests, smoke, overlay engine, API, schema drift, Tailwind. The smoke install step's time is recorded in *Decisions* against the Lerna baseline (83–93 seconds), with whichever of "shorter" or "not yet shorter" is true.
8. The PR body lists every source change that is not packaging: today `verifySurveyInvite` throwing on a disabled survey, the `Set` iterator guard in the legend compiler, the `ignoreMutation` signature, and whatever the consolidation adds.
9. A no-product-change deploy from the merged commit passes the production probe. This is the phase exit; the pull request is complete before it, and the probe result is recorded here afterward.

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

*(October 2026)* The spike may start on a throwaway branch while phase 3 is underway, so the worker, WASM, and environment-variable problems are known before the journeys that gate them exist. It does not merge until those journeys are green on CRA.

The journeys are the acceptance test. They do not import `react-scripts`, so they carry over unchanged. *(October 2026)* Phase 3 chooses part of its journey list for this purpose: the surfaces a bundler swap breaks at runtime rather than at typecheck ([integration testing](integration-testing.md)). Before the first production deploy, the client preview workflow publishes the new build to a real host.

*(October 2026)* The phase 4 pull request deletes every row in *Pins carried into phase 4*, and the consolidation rules above apply to the client's own dependencies as the pins come off: newest release within the same major, journeys as the test.

Workers, Lambda containers, and CDK's esbuild keep their build tools. "Consistent builds" means shared versions, one install, and standard script names, not one compiler everywhere.

## Decisions

- Node LTS, workspaces, and the client bundler are three pull requests with separate deploys, in that order.
- *(October 2026)* A single pull request for workspaces and the bundler was considered after the first workspace install exposed the pin debt, and rejected. Most of that debt is Create React App's, and a combined change would avoid writing it, but it would also put a new install layout, a new dependency tree, and a new bundler into one production deploy with only the read-only probe as the safety net, make a smoke failure unattributable, and hold a 20,000-line lockfile open against every `package.json` change on `master` for the duration of the phase 3 testing work. The workspaces pull request instead widens to dependency consolidation and project references (the same resolution-and-build axis), merges when its checkpoints hold, and carries the CRA pins as a named temporary list that the phase 4 pull request deletes.
- Dependency consolidation: one `graphql` 15.x for the tree, PostGraphile and its plugins on the newest 4.14.x, one `pg` 8.x and one `@types/pg`, one copy of each library two workspaces import, one range per tool, regenerated schema, client types, and Tailwind output. Same-major moves only. The steps and checkpoints are under *Phase 2b*.
- TypeScript project references: each composite package declares its workspace dependencies as `references`, `tsc -b <package>` builds only that package's transitive dependencies, and CI and images build the target they test. `build:libs` shrinks to non-`tsc` steps or is deleted.
- *(October 2026)* Node 24. It is the Active LTS that Lambda runs in production; Node 26 is still a Lambda public preview. No native dependency forced an older Node. Subdivision and the PII classifier stay on their Python images. Lambdas that imported `aws-sdk` from the Node 14 runtime now call SDK v3, which Node 24 includes. The phase 2a exit stays open until this runtime is deployed and the production probe passes.
- npm workspaces. No Nx, Turborepo, or new Lerna. Task caching may be reconsidered after phase 4 if CI is still slow. *(October 2026)* The root `package.json` `workspaces` field is `packages/*`. `npm run bootstrap` is `npm install`. CI and the deploy workflow run `npm ci` at the root.
- *(October 2026)* Every CI job and the local install use a full root `npm ci` / `npm install`. One cache key, `package-lock.json`. On npm 11, `npm ci --workspace` still installs every workspace's production dependencies, so it does not shrink an image. Production images copy only the workspace packages they compile and run `npm install` against the root lockfile. Missing workspaces make `npm ci` refuse the lockfile; `npm install` keeps the locked versions for the packages that are present.
- *(October 2026)* Internal dependencies are version ranges the local version satisfies. The `file:` links in `pmtiles-server` and `data-library-gmw` are ranges.
- *(October 2026)* Application packages use TypeScript 5.8.3. `pmtiles-server` aligns with that version: its typecheck reports the same diagnostics on 5.8 and 7, and Wrangler bundles with esbuild, so the TypeScript 7 pin was not required. `@types/jest` stays nested (the client is still on Create React App's Jest 26, the API suite on an older Jest, other packages on Jest 29). Forcing one `@types/jest` would typecheck the client against the wrong Jest. `@types/react` is only declared by the client. The API and the client keep their different `@mapbox/mapbox-gl-style-spec` majors, nested by npm. Root `overrides` keep the unified tree on the versions this source already typechecks against: `@types/express` 4.17.25 and `@types/express-serve-static-core` 4.19.9 (Express 4 types; a bare install selects the Express 5 types), `@types/mapbox-gl` 3.1.0, and `mapbox-gl` 3.4.0 (the client's exact pin; the API previously locked 3.3.0). Every package's `aws-sdk` v2 range is satisfied by one copy. The survey invite calls pass `DefaultTemplateData: "{}"` because that field is required on the resolved SDK types; destinations still supply their own replacement tags. `overlay-worker` keeps `pbf` 4, and its geobuf decode call casts that instance to the `pbf` 3 type `@types/geobuf` resolves from the hoisted copy. Express 4 query values are `string | ParsedQs`, so the API handlers that read tokens narrow them to strings. `bytes` can return null, and the upload size limits coerce that to a number. `@types/bytes` stays on 3.1.2 so the client's `bytes()` calls stay typed as strings. The first workspace install floated packages the separate lockfiles had pinned, and Jest and webpack still aliased `polyclip-ts` and `splaytree-ts` into `overlay-engine/node_modules`, which npm no longer creates. Those aliases use the hoisted CJS build, or a nested copy when one is present. `overlay-engine` depends on `lru-cache` 11 so its range reader does not load the hoisted v7. Further root devDependencies, with matching overrides, pin `browserslist` to 4.24.4 and `caniuse-lite` to 1.0.30001695 (the client lock Tailwind was generated with) and `@radix-ui/react-use-controllable-state` to 1.2.2, `@radix-ui/react-context-menu` to 2.1.5, and `@radix-ui/react-scroll-area` to 1.0.5 (webpack 4 cannot resolve the `is-development` export those newer releases import). The development server is the other webpack 4 constraint: its browserslist targets are current browsers, so Babel leaves class fields and static blocks in place and webpack 4's parser rejects them (the production build transpiles them). Overrides therefore hold `@radix-ui/react-accordion` at 1.1.2, `react-dropdown-menu` at 2.0.6, `react-menubar` at 1.0.4, `react-radio-group` at 1.3.8, `react-select` at 2.0.0, `react-slider` at 1.1.2, and `react-toggle-group` at 1.1.0 (the client lock's versions; later releases depend on `@radix-ui/react-collection` 1.2.0, which uses a static block), and the client pins `sql.js` 1.8.0 (1.15 ships class fields). `@tailwindcss/forms` stays on 0.5.10 and `@tailwindcss/typography` on 0.5.16. The root depends on `graphql` 15.8.0, the client's previous lock, so Apollo and `graphql-codegen` share that copy and the generated hooks stay in the committed order. The API depends on `graphql` 14.6.0, nested under `packages/api`, and PostGraphile resolves that same copy. That is the GraphQL `lexicographicSortSchema` uses when checking schema drift. The report tab node view accepts the selection mutation record current `prosemirror-view` passes to `ignoreMutation`. TypeScript 5.8 types `Set` iterator values as possibly undefined, and the legend compiler skips that case. `slonik` is kept on `pg` 8.5.1. The API depends on `pg` 8.3.0, `postgraphile` 4.14.0, `graphile-utils` 4.14.0, `@graphile-contrib/pg-simplify-inflector` 6.0.0, `slonik` 23.0.2, `slonik-sql-tag-raw` 1.0.2, and `mockdate` 3.0.2. `sanitize-html` stays on 2.11.0 so the client build does not pick up an `htmlparser2` that imports the `entities/decode` subpath webpack 4 cannot resolve. The API Jest resolver and the client webpack config rewrite `node:` built-ins, which current AWS SDK and `sql.js` packages import and which Jest 26 and webpack 4 treat as files. The client production build gives Node a 4 GB heap; webpack 4 exceeds the default limit while optimizing this bundle.
- *(October 2026)* The pins recorded in the previous decision were the first workspace commit's way of holding product behavior still. They are sorted into two lists under *Phase 2b*: pins the consolidation step removes in this pull request (GraphQL 14, the graphile and `pg` versions, `browserslist` and `caniuse-lite`, the duplicate ProseMirror and Apollo copies), and *Pins carried into phase 4*, which exist for webpack 4 and Jest 26 and are deleted with Create React App.
- *(October 2026)* Compiler `dist/` is gitignored. `npm run build:libs` builds the libraries in dependency order, including `overlay-worker` because the API imports its declarations, then the API build is `tsc -b`. Nothing commits `dist/`. The dependency-ordered list is an interim arrangement; the project-references work replaces it, and the API build step went from 14 seconds under Lerna to 42–44 seconds under it because every job built every library. `@seasketch/data-library-gmw`'s `build` script is the data-library job, not compiler output, and it is not part of `build:libs`.
- *(October 2026)* Docker images. `spatial-uploads-handler` and `data-tables-handler` build from the repo root with the root lockfile and `--omit=dev`. Subdivision and the PII classifier stay outside the workspace because they are Python images. The database migration image and the maintenance container stay self-contained: they install a few named packages and do not compile workspace TypeScript. `packages/client/graphql-validate` keeps its own lockfile so the deploy gate resolves `graphql@15.3.0` only. `packages/infra/lambdas/dataHostDbUpdater` and `dataHostingStackHook` stay outside because CDK zips those directories and their `node_modules` have to be inside the zip.
- *(October 2026)* `NodejsFunction` bundling. Functions that set `nodeModules` use a pruned `bundle-package-lock.json` generated by `scripts/write-lambda-bundle-lockfiles.mjs`. CDK writes a synthetic package.json of those modules and runs `npm ci`, which a workspace lockfile does not satisfy. Functions that only bundle with esbuild set `projectRoot` to the repo root and `depsLockFilePath` to the root lockfile.
- Client environment variable names change once, with the bundler.

## Open questions

- *(After phase 4)* Whether to move application packages to TypeScript 7's native compiler for faster checks in CI and the editor. It is the most direct fix for typecheck cost, but it depends on tools that use TypeScript's JavaScript API — `@typescript-eslint`, codegen, and CRA's type checker until phase 4 removes it — supporting it. Record the outcome here even if it is "not yet." *(October 2026)* Checked during phase 2b: `typescript@7.0.2` is on npm and its `tsc` runs this tree once the removed options are replaced, but no release of `@typescript-eslint` or `ts-jest` accepts it yet. The tsconfig changes land in 2b so that the eventual switch is a version bump.
- *(Phase 4)* Vite or the recorded fallback; Vitest or Jest; how the Cloudflare preview and deploy steps upload the new build output.
- *(Phase 2b)* Whether the smoke install gets materially shorter from consolidation alone. The first workspace commit's root `npm ci` took 78–115 seconds in CI against Lerna's 83–93; the tree held 7,203 packages, with five Cloudflare Worker packages each nesting 170–190 MB. If one range per tool and one `wrangler` do not close the gap, the remaining options — `--install-strategy=linked`, pruning Worker packages from the CI install, or a different package manager — are recorded here with the measurement, and the exit criterion is reworded to what was achieved.
- *(Phase 2b)* Whether the production Docker images can return to `npm ci`. They use `npm install` against a partial workspace because `npm ci` refuses a lockfile whose workspaces are absent. Copying every workspace's `package.json` (manifests only) into the image, or generating pruned lockfiles as `write-lambda-bundle-lockfiles.mjs` does for CDK, would restore a reproducible install. Decide during consolidation; record the outcome.
- *(Phase 2b)* Whether `email-status-handler` should depend on the whole `@seasketch/api` package. It does today, which pulls the API's dependency tree into that Lambda's bundle.

## Exit criteria

- **Phase 2a:** One Node Active LTS across local, CI, the GraphQL image, and Lambdas, deployed to production, with the probe passing.
- **Phase 2b:** Lerna is gone. There is one root lockfile, with every exception named here. CI and deploy install from the root. The GraphQL image and Lambda bundles build from the workspace. One `graphql`, one `pg`, one copy of each shared library, one range per tool, and every surviving override in the carried-pins table. `tsc -b` of a package builds only its dependencies, and CI builds the target it tests. Smoke is green, and its install time is recorded against the Lerna baseline. A no-product-change deploy passes the production probe. *Install, lockfile, and build paths landed October 2026. The smoke job's install is one root `npm ci`. Consolidation and project references are the open checkpoints under Phase 2b. The production probe is the deploy workflow's check on the first deploy of this change.*
- **Phase 4:** CRA and `--openssl-legacy-provider` are gone. Phase 1 and phase 3 journeys pass on the new dev server and production build. ESLint and client tests no longer depend on CRA. The client CI build and dev-server startup are materially faster. The preview and deploy workflows publish the new output.
