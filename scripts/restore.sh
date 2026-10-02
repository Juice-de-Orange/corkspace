#!/usr/bin/env bash
# Restore a backup produced by backup.sh.
# Usage:  scripts/restore.sh <db-*.dump> <assets-*.tgz>
# The corkspace compose stack must be up (db container running). DESTRUCTIVE: replaces DB objects
# and the assets volume contents.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/infra/.env}"
# shellcheck disable=SC1090
set -a; [ -f "$ENV_FILE" ] && . "$ENV_FILE"; set +a

DUMP="${1:?usage: restore.sh <db-*.dump> <assets-*.tgz>}"
ASSETS="${2:?usage: restore.sh <db-*.dump> <assets-*.tgz>}"
DB_CONTAINER="${DB_CONTAINER:-corkspace-db-1}"
ASSETS_VOLUME="${ASSETS_VOLUME:-corkspace_assets}"
PGUSER="${POSTGRES_USER:-corkspace}"
PGDB="${POSTGRES_DB:-corkspace}"

echo "[restore] pg_restore into $PGDB (clean + recreate)"
docker exec -i "$DB_CONTAINER" pg_restore -U "$PGUSER" -d "$PGDB" --clean --if-exists --no-owner < "$DUMP"

echo "[restore] restore assets volume $ASSETS_VOLUME"
ASSETS_DIR="$(cd "$(dirname "$ASSETS")" && pwd)"
ASSETS_FILE="$(basename "$ASSETS")"
docker run --rm -v "$ASSETS_VOLUME":/data -v "$ASSETS_DIR":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/$ASSETS_FILE -C /data"

echo "[restore] done. Restart api/worker to pick up restored state: docker compose -f infra/docker-compose.yml --env-file infra/.env restart api worker"
