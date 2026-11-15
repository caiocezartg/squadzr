#!/bin/sh
# Dumps the production database and uploads the dump to the private R2 bucket (#136).
# Any failure exits non-zero, so Railway reports the cron run as failed. It prints no secret on purpose.
set -eu

for name in DATABASE_URL R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_ENDPOINT; do
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    echo "db-backup: $name is not set" >&2
    exit 1
  fi
done

# The AWS CLI reads its credentials and settings from these variables.
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
# R2 has no regions; `auto` is the value it documents.
export AWS_DEFAULT_REGION=auto
# Recent AWS CLI versions add checksum headers R2 does not accept; send them only when the API requires.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

dump_dir=$(mktemp -d)
trap 'rm -rf "$dump_dir"' EXIT

dump_name="squadzr-$(date -u +%Y-%m-%dT%H%M%SZ).dump"
dump_file="$dump_dir/$dump_name"
object_key="postgres/$dump_name"

echo "db-backup: dumping to $dump_name"
pg_dump --format=custom --no-owner --no-acl --file="$dump_file" "$DATABASE_URL"

if [ ! -s "$dump_file" ]; then
  echo "db-backup: the dump is empty" >&2
  exit 1
fi
# A dump pg_restore cannot read is not a backup: fail now, not on the day of the restore.
pg_restore --list "$dump_file" >/dev/null
dump_bytes=$(wc -c <"$dump_file" | tr -d ' ')

echo "db-backup: uploading $object_key"
aws s3 cp "$dump_file" "s3://$R2_BUCKET/$object_key" --endpoint-url "$R2_ENDPOINT" --only-show-errors

remote_bytes=$(aws s3api head-object --bucket "$R2_BUCKET" --key "$object_key" \
  --endpoint-url "$R2_ENDPOINT" --query ContentLength --output text)
if [ "$remote_bytes" != "$dump_bytes" ]; then
  echo "db-backup: uploaded $remote_bytes bytes, expected $dump_bytes" >&2
  exit 1
fi

echo "db-backup: done, $dump_bytes bytes at s3://$R2_BUCKET/$object_key"
