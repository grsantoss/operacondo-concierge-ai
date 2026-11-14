#!/bin/sh
# Roda uma vez, quando o volume do Postgres é criado (docker-entrypoint-initdb.d).
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v dbname="$POSTGRES_DB" \
  -v owner_pw="$OC_OWNER_PASSWORD" -v app_pw="$OC_APP_PASSWORD" -v admin_pw="$OC_ADMIN_PASSWORD" \
  -f /bootstrap/bootstrap.sql
