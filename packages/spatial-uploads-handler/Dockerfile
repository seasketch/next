# Application image for the spatial uploads handler. Build context is the
# repo root (see UploadHandlerLambdaStack, scripts/build-images.mjs, and
# compose.yaml). The slow part, GDAL and the other native tools, is the
# prebuilt runtime image below; see Dockerfile.runtime for how it is
# published and how this pin is kept current.
ARG RUNTIME_IMAGE=ghcr.io/seasketch/spatial-uploads-runtime:875ae7ebca02

FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:24 AS builder
WORKDIR /usr/app
# Only these workspaces are copied. npm ci refuses a lockfile whose other
# workspaces are absent, and npm ci --workspace still installs every
# workspace. npm install keeps the locked versions for the packages present.
# devDependencies stay: gdal-async and aws-sdk are imported by the handler
# at runtime and their types are needed to compile.
#
# Manifests first so the install layer survives source edits.
COPY package.json package-lock.json ./
COPY packages/spatial-uploads-handler/package.json ./packages/spatial-uploads-handler/
COPY packages/geostats-types/package.json ./packages/geostats-types/
COPY packages/metadata-parser/package.json ./packages/metadata-parser/
COPY packages/ai-data-analyst/package.json ./packages/ai-data-analyst/
RUN npm install --no-audit --no-fund
COPY packages/spatial-uploads-handler ./packages/spatial-uploads-handler
COPY packages/geostats-types ./packages/geostats-types
COPY packages/metadata-parser ./packages/metadata-parser
COPY packages/ai-data-analyst ./packages/ai-data-analyst
RUN npm run build --workspace=spatial-uploads-handler

FROM ${RUNTIME_IMAGE}
WORKDIR ${LAMBDA_TASK_ROOT}
# Keep the workspace layout: node_modules/@seasketch/* and ai-data-analyst
# are symlinks into packages/, and any package-local node_modules must stay
# next to the code that resolves them.
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/app/packages ./packages
COPY packages/spatial-uploads-handler/.rclone.conf /var/task/rclone.conf
CMD ["packages/spatial-uploads-handler/dist/handler.processUpload"]
