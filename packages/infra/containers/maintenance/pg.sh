#!/bin/sh
echo "Setting DATABASE_URL and PGPASSWORD. Will expire in 15 minutes."
echo "Run 'psql' to connect to the database"
echo "Access to the maintenance bastion is logged and audited"
echo "Please log your activities here: https://docs.google.com/spreadsheets/d/16CDycF3yztCRE-IfPEJ_MoqTWikRZpQwJoUIKFmNtzU/edit?usp=sharing"
FILE=/root/rds-global-bundle.pem
if [ ! -f "$FILE" ]; then
  wget "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" -O "$FILE"
fi
export PGPASSWORD="$(aws rds generate-db-auth-token --hostname $PGHOST --port $PGPORT --region $PGREGION --username $PGUSER)"
export PGSSLMODE="verify-full"
export PGSSLROOTCERT="$FILE"
export DATABASE_URL="postgres://$PGUSER:$(node --eval "console.log(encodeURIComponent(process.env.PGPASSWORD))")@$PGHOST:$PGPORT/$PGDATABASE?ssl=1&sslmode=verify-full&sslrootcert=$FILE"
export ADMIN_DATABASE_URL="$DATABASE_URL"