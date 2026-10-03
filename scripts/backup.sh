#!/usr/bin/env bash
# Nightly backup: Postgres custom-format dump + assets-volume tarball.
# Run from the repo on the Docker host (the corkspace compose stack must be up).
# Cron example (daily 03:30):  30 3 * * *  /opt/corkspace/scripts/backup.sh >> /var/backups/corkspace/backup.log 2>&1
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/infra/.env}"
# shellcheck disable=SC1090
set -a; [ -f "$ENV_FILE" ] && . "$ENV_FILE"; set +a

BACKUP_DIR="${BACKUP_DIR:-$HOME/corkspace-backups}"
DB_CONTAINER="${DB_CONTAINER:-corkspace-db-1}"
ASSETS_VOLUME="${ASSETS_VOLUME:-corkspace_assets}"
RETAIN="${RETAIN:-14}"
PGUSER="${POSTGRES_USER:-corkspace}"
PGDB="${POSTGRES_DB:-corkspace}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# Both files are written under a .partial name and renamed when complete, so a failed run
# leaves no empty db-*.dump behind that the prune below would count as a backup.
trap 'rm -f "$BACKUP_DIR/db-$STAMP.dump.partial" "$BACKUP_DIR/assets-$STAMP.tgz.partial"' EXIT

echo "[backup $STAMP] pg_dump $PGDB from $DB_CONTAINER"
docker exec -i "$DB_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" -Fc > "$BACKUP_DIR/db-$STAMP.dump.partial"
mv "$BACKUP_DIR/db-$STAMP.dump.partial" "$BACKUP_DIR/db-$STAMP.dump"

echo "[backup $STAMP] tar assets volume $ASSETS_VOLUME"
docker run --rm -v "$ASSETS_VOLUME":/data:ro -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/assets-$STAMP.tgz.partial" -C /data .
mv "$BACKUP_DIR/assets-$STAMP.tgz.partial" "$BACKUP_DIR/assets-$STAMP.tgz"

# Prune to the most recent $RETAIN of each kind.
ls -1t "$BACKUP_DIR"/db-*.dump 2>/dev/null | tail -n +$((RETAIN + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/assets-*.tgz 2>/dev/null | tail -n +$((RETAIN + 1)) | xargs -r rm -f

echo "[backup $STAMP] done → $BACKUP_DIR/db-$STAMP.dump  $BACKUP_DIR/assets-$STAMP.tgz"
