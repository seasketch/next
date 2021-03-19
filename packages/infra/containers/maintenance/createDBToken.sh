#!/bin/sh
export PGPASSWORD="$(aws rds generate-db-auth-token --hostname $PGHOST --port $PGPORT --region $PGREGION --username $PGUSER)"
