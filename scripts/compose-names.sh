# shellcheck shell=bash
# Sourced by backup.sh and restore.sh (after HERE and ENV_FILE are set): resolve the container and
# volume names from the running compose project instead of assuming fixed names, so a stack started
# under another project name (`name:` in the compose file, COMPOSE_PROJECT_NAME in the env file or
# the environment) is found. Explicitly set DB_CONTAINER, API_CONTAINER, WORKER_CONTAINER and
# ASSETS_VOLUME still win. If the stack cannot be found, the old fixed names are the fallback.

COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-$HERE/infra/docker-compose.yml}"

# Container name of a compose service (running or stopped), or nothing.
compose_container() {
  local id
  id="$(docker compose -f "$COMPOSE_FILE_PATH" --env-file "$ENV_FILE" ps -a -q "$1" 2>/dev/null | head -n 1)"
  if [ -n "$id" ]; then
    docker inspect -f '{{.Name}}' "$id" | sed 's#^/##'
  fi
}

DB_CONTAINER="${DB_CONTAINER:-$(compose_container db)}"
DB_CONTAINER="${DB_CONTAINER:-corkspace-db-1}"
API_CONTAINER="${API_CONTAINER:-$(compose_container api)}"
API_CONTAINER="${API_CONTAINER:-corkspace-api-1}"
WORKER_CONTAINER="${WORKER_CONTAINER:-$(compose_container worker)}"
WORKER_CONTAINER="${WORKER_CONTAINER:-corkspace-worker-1}"
if [ -z "${ASSETS_VOLUME:-}" ]; then
  COMPOSE_PROJECT="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$DB_CONTAINER" 2>/dev/null || true)"
  ASSETS_VOLUME="${COMPOSE_PROJECT:-corkspace}_assets"
fi
