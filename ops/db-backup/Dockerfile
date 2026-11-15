# Daily PostgreSQL backup (#136). The base image carries pg_dump and pg_restore 16, the major version
# of the production database (the `postgres` service pins ghcr.io/railwayapp-templates/postgres-ssl:16).
# Pinned to an exact release: moving it is a reviewed change to this line.
FROM postgres:16.16-alpine3.24

# The AWS CLI talks to R2 through its S3 API. R2 answers the same calls, so no R2-specific client is needed.
RUN apk add --no-cache aws-cli

COPY ops/db-backup/backup.sh /usr/local/bin/backup.sh
RUN chmod 0755 /usr/local/bin/backup.sh

# The postgres image's own entrypoint starts a database server; this container only runs the script and exits.
USER postgres
ENTRYPOINT ["/usr/local/bin/backup.sh"]
