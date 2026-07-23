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
# Replace registry package with the freshly built workspace copy.
# (cp -r into an existing dir nests; remove first.)
RUN rm -rf node_modules/@seasketch/geostats-types \
  && mkdir -p node_modules/@seasketch \
  && cp -r /usr/geostats-types node_modules/@seasketch/geostats-types
COPY data-tables-handler/tsconfig.json data-tables-handler/handler.ts ./
COPY data-tables-handler/src ./src
RUN npm run build

FROM amazon/aws-lambda-nodejs:20
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/app/dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
CMD ["handler.processDataTableUpload"]
