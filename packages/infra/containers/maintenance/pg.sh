#!/bin/sh
echo "Setting DATABASE_URL and PGPASSWORD. Will expire in 15 minutes."
echo "Run 'psql' to connect to the database"
FILE=/root/rds-ca-2019-root.pem
if [ ! -f $FILE ]; then
  wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem" -O $FILE
fi
export PGPASSWORD="$(aws rds generate-db-auth-token --hostname $PGHOST --port $PGPORT --region $PGREGION --username $PGUSER)"
export DATABASE_URL="postgres://$PGUSER:$(node --eval "console.log(encodeURIComponent(process.env.PGPASSWORD))")@$PGHOST:$PGPORT/$PGNAME?ssl=1&sslmode=no-verify&sslrootcert=$FILE"