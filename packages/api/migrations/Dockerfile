# Used by infra/lib/DatabaseStack to initialize a fresh
# RDS instance.
FROM amazon/aws-lambda-nodejs:14
WORKDIR /var/task
RUN npm init -y
RUN npm install graphile-migrate pg aws-sdk
RUN mkdir migrations
COPY committed migrations/committed
RUN chmod a+r migrations/committed/*
COPY migrate.js .
CMD ["migrate.handler"]