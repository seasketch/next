FROM public.ecr.aws/lambda/nodejs:24 AS builder
WORKDIR /usr/app
# Build context is the repo root. Copy only the workspaces this image
# compiles. npm install uses the root lockfile for those packages.
# devDependencies stay: @types/* and dotenv (imported by server.ts) are
# needed to compile. DuckDB is a runtime dependency.
COPY package.json package-lock.json ./
COPY packages/data-tables-handler ./packages/data-tables-handler
COPY packages/geostats-types ./packages/geostats-types
RUN npm install --no-audit --no-fund \
 && npm run build --workspace=@seasketch/geostats-types \
 && npm run build --workspace=data-tables-handler

FROM public.ecr.aws/lambda/nodejs:24
WORKDIR ${LAMBDA_TASK_ROOT}
# Keep the workspace layout: node_modules/@seasketch/geostats-types is a
# symlink into packages/, and any package-local node_modules must stay next
# to the code that resolves them.
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/app/packages ./packages
CMD ["packages/data-tables-handler/dist/handler.processDataTableUpload"]
