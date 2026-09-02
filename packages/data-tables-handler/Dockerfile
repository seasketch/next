FROM amazon/aws-lambda-nodejs:20 AS builder
WORKDIR /usr/app
# geostats-types has no typescript dep; match spatial-uploads-handler
RUN npm install -g typescript@5.5
COPY data-tables-handler/package.json data-tables-handler/package-lock.json ./
RUN npm ci
WORKDIR /usr/geostats-types
COPY geostats-types/package.json geostats-types/package-lock.json ./
RUN npm ci
COPY geostats-types/ ./
RUN npm run build
WORKDIR /usr/app
# Replace the registry package with the freshly built workspace copy.
# Copy only the published shape (package.json + dist) so tsc does not
# follow composite source files under /usr/geostats-types/lib.
RUN rm -rf node_modules/@seasketch/geostats-types \
  && mkdir -p node_modules/@seasketch/geostats-types \
  && cp /usr/geostats-types/package.json node_modules/@seasketch/geostats-types/ \
  && cp -r /usr/geostats-types/dist node_modules/@seasketch/geostats-types/dist
COPY data-tables-handler/tsconfig.json data-tables-handler/handler.ts ./
COPY data-tables-handler/src ./src
# Tests import workspace source via a relative path that is outside rootDir here.
RUN rm -f src/*.test.ts
RUN npm run build

FROM amazon/aws-lambda-nodejs:20
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/app/dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
CMD ["handler.processDataTableUpload"]
