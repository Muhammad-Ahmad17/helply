#!/usr/bin/env bash
# Restore Postgres from a gzipped dump in DO Spaces.
# Usage: SPACES_BUCKET=... AWS_ACCESS_KEY_ID=... ./restore-pg.sh backups/ragify-20260101T000000Z.sql.gz
set -euo pipefail

FILE="${1:?Usage: restore-pg.sh <s3-key>}"
aws s3 cp "s3://${SPACES_BUCKET}/${FILE}" /tmp/restore.sql.gz --endpoint-url "https://${SPACES_ENDPOINT}"
gunzip -c /tmp/restore.sql.gz | psql "${DATABASE_URL}"
echo "Restore complete from ${FILE}"
