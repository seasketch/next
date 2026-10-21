FROM public.ecr.aws/lambda/nodejs:24 AS builder
WORKDIR /usr/app
# Build context is the repo root. Copy only the workspaces this image
# compiles. npm install uses the root lockfile for those packages.
# typescript is a dependency, so --omit=dev still compiles. DuckDB stays
# because it is a runtime dependency.
COPY package.json package-lock.json .npmrc ./
COPY packages/data-tables-handler ./packages/data-tables-handler
COPY packages/geostats-types ./packages/geostats-types
RUN npm install --no-audit --no-fund --omit=dev \
 && npm run build --workspace=@seasketch/geostats-types \
 && npm run build --workspace=data-tables-handler

FROM public.ecr.aws/lambda/nodejs:24
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/packages/data-tables-handler/dist/* ./
COPY --from=builder /usr/app/packages/data-tables-handler/dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
CMD ["handler.processDataTableUpload"]
