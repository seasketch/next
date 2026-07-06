FROM amazon/aws-lambda-nodejs:20 as builder
WORKDIR /usr/app
COPY data-tables-handler/package.json ./
RUN npm install
WORKDIR /usr/geostats-types
COPY geostats-types/package.json geostats-types/package-lock.json ./
RUN npm ci
COPY geostats-types/ ./
RUN npm run build
WORKDIR /usr/app
RUN mkdir -p node_modules/@seasketch && cp -r /usr/geostats-types node_modules/@seasketch/geostats-types
COPY data-tables-handler/handler.ts ./
COPY data-tables-handler/src ./src
RUN npm run build

FROM amazon/aws-lambda-nodejs:20
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/app/dist/src ./src
COPY --from=builder /usr/app/node_modules ./node_modules
CMD ["handler.processDataTableUpload"]
