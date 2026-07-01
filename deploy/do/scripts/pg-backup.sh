#!/bin/sh
set -eu
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="/tmp/ragify-${STAMP}.sql.gz"
pg_dump | gzip > "$FILE"
if command -v aws >/dev/null 2>&1; then
  aws s3 cp "$FILE" "s3://${S3_BUCKET}/backups/" --endpoint-url "https://${S3_ENDPOINT}"
  echo "Backup uploaded: ${STAMP}"
else
  echo "aws cli not found; backup saved locally: $FILE"
fi
