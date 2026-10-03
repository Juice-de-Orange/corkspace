#!/usr/bin/env bash
# Restore a backup produced by backup.sh.
# Usage:  scripts/restore.sh <db-*.dump> <assets-*.tgz>
# The corkspace compose stack must be up (db container running). DESTRUCTIVE: replaces DB objects
# and the assets volume contents. api and worker are stopped for the duration and started again.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/infra/.env}"
# shellcheck disable=SC1090
set -a; [ -f "$ENV_FILE" ] && . "$ENV_FILE"; set +a

DUMP="${1:?usage: restore.sh <db-*.dump> <assets-*.tgz>}"
ASSETS="${2:?usage: restore.sh <db-*.dump> <assets-*.tgz>}"
DB_CONTAINER="${DB_CONTAINER:-corkspace-db-1}"
API_CONTAINER="${API_CONTAINER:-corkspace-api-1}"
WORKER_CONTAINER="${WORKER_CONTAINER:-corkspace-worker-1}"
ASSETS_VOLUME="${ASSETS_VOLUME:-corkspace_assets}"
PGUSER="${POSTGRES_USER:-corkspace}"
PGDB="${POSTGRES_DB:-corkspace}"

# Everything is checked before the first destructive step: a typo in a path or a truncated file
# must not cost the database or the assets volume.
abort() { echo "[restore] $1 — nothing was changed" >&2; exit 1; }
[ -f "$DUMP" ] && [ -r "$DUMP" ] || abort "database dump not found or not readable: $DUMP"
[ -f "$ASSETS" ] && [ -r "$ASSETS" ] || abort "assets tarball not found or not readable: $ASSETS"
ASSETS_DIR="$(cd "$(dirname "$ASSETS")" && pwd)"
ASSETS_FILE="$(basename "$ASSETS")"
docker exec -i "$DB_CONTAINER" pg_restore --list < "$DUMP" > /dev/null \
  || abort "pg_restore cannot read $DUMP (or the db container $DB_CONTAINER is not running)"
docker run --rm -v "$ASSETS_DIR":/backup:ro alpine tar tzf "/backup/$ASSETS_FILE" > /dev/null \
  || abort "tar cannot list $ASSETS"
docker volume inspect "$ASSETS_VOLUME" > /dev/null \
  || abort "assets volume $ASSETS_VOLUME does not exist"

# No writers during the restore: stop api and worker if they run, and start them again on the way
# out — also when a step below fails, so a failed restore does not leave the instance down.
STOPPED=()
start_stopped() {
  if [ ${#STOPPED[@]} -gt 0 ]; then
    echo "[restore] start ${STOPPED[*]}"
    docker start "${STOPPED[@]}" > /dev/null
    STOPPED=()
  fi
}
trap start_stopped EXIT
for c in "$API_CONTAINER" "$WORKER_CONTAINER"; do
  if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ]; then
    echo "[restore] stop $c"
    docker stop "$c" > /dev/null
    STOPPED+=("$c")
  fi
done

echo "[restore] pg_restore into $PGDB (clean + recreate)"
docker exec -i "$DB_CONTAINER" pg_restore -U "$PGUSER" -d "$PGDB" --clean --if-exists --no-owner < "$DUMP"

echo "[restore] restore assets volume $ASSETS_VOLUME"
docker run --rm -v "$ASSETS_VOLUME":/data -v "$ASSETS_DIR":/backup:ro alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/$ASSETS_FILE -C /data"

if [ ${#STOPPED[@]} -gt 0 ]; then
  start_stopped
  echo "[restore] done."
else
  echo "[restore] done. No running $API_CONTAINER / $WORKER_CONTAINER found — if your api and worker containers have other names, restart them now."
fi
