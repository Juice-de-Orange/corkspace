# Deployment

Corkspace runs as a small Docker Compose stack on any Linux host with Docker Engine and the Compose
plugin. TLS is terminated by a reverse proxy of your choice in front of the stack. The examples use
`corkspace.example.com`; replace it with your own hostname.

## What runs

`infra/docker-compose.yml` (Compose project name `corkspace`) defines:

| Service | Image / build | Role |
|---|---|---|
| `db` | `postgres:16-alpine` | Database; data in the `pgdata` volume |
| `migrate` | `infra/Dockerfile.node` | One-shot: applies pending migrations, then exits |
| `api` | `infra/Dockerfile.node` | Hono API + Better Auth on port 3000 (internal only) |
| `worker` | `infra/Dockerfile.node` | Image processing queue (sharp, SSRF-safe downloads) |
| `web` | `infra/Dockerfile.web` | nginx serving the built SPA and proxying `/api/` to `api`; published on `${WEB_PORT}` (default 8080) |

`api` and `worker` start only after `db` is healthy and `migrate` has completed successfully. Uploaded
images live in the `assets` volume, shared by `api`, `worker` and (read-only) `web`.

The `web` nginx already sends the security headers (CSP, HSTS, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`), serves the hashed bundle under
`/static/` with a one-year immutable cache and allows request bodies up to 12 MB on `/api/`.

## 1. Configure

```bash
git clone <your fork or this repository> corkspace
cd corkspace
cp .env.example infra/.env
chmod 600 infra/.env
```

Edit `infra/.env`. The backup scripts read `infra/.env` by default, so keep it there.

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | **yes** | Compose refuses to start without it; there is no fallback. Use a long random value. |
| `POSTGRES_USER`, `POSTGRES_DB` | no | Default `corkspace`. |
| `BETTER_AUTH_SECRET` | **yes** | Signs sessions. At least 16 characters are enforced; use 32+ random characters, e.g. `openssl rand -base64 48`. |
| `BETTER_AUTH_URL` | **yes** | The public URL users open, e.g. `https://corkspace.example.com`. |
| `AUTH_TRUSTED_ORIGINS` | **yes** | Comma-separated origins allowed to call the auth endpoints; normally the same URL. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | **yes** | The first administrator (password at least 8 characters). See §4. |
| `ADMIN_NAME` | no | Display name of the first administrator, default `Admin`. |
| `WEB_PORT` | no | Host port of the `web` service, default 8080. |

`DATABASE_URL` is composed automatically inside the stack; set it only when you run the api or
worker outside Compose. `API_PORT`, `ASSET_DIR` and `NODE_ENV` are fixed by the compose file. The
`SMTP_*` variables are accepted by the configuration schema but not used yet — there are no
outgoing emails; administrators reset passwords in `/admin`.

Never commit `infra/.env`; it is ignored by `.gitignore`.

## 2. Start

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.yml --env-file infra/.env ps -a
curl -fsS http://localhost:8080/api/health    # {"status":"ok","db":"up"}
```

`migrate` should show `Exited (0)`; `db` and `api` should be `healthy`. Until `api` is healthy, `/api/`
requests return 502 for a few seconds.

## 3. Put a reverse proxy with TLS in front

Point the proxy at `http://localhost:${WEB_PORT}`. Requirements:

- **HTTPS is mandatory.** In production the session cookies are `Secure`, so login does not work over
  plain HTTP. `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS` must match the public `https://` origin.
- Allow request bodies of **at least 12 MB** (image uploads, feedback screenshots).
- Forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`.
- If a CDN sits in front, do not cache `index.html`; everything under `/static/` is content-hashed
  and safe to cache forever.

**Caddy** (obtains and renews certificates automatically):

```caddyfile
corkspace.example.com {
    reverse_proxy localhost:8080
}
```

**nginx** (certificates from certbot or similar):

```nginx
server {
    listen 443 ssl http2;
    server_name corkspace.example.com;

    ssl_certificate     /etc/letsencrypt/live/corkspace.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/corkspace.example.com/privkey.pem;

    client_max_body_size 12m;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name corkspace.example.com;
    return 301 https://$host$request_uri;
}
```

Compose publishes `WEB_PORT` on all interfaces. Docker-published ports bypass some host firewalls
(for example `ufw`), so if the proxy runs on the same host, bind the port to loopback in an
untracked override file and pass it as a second `-f`:

```yaml
# infra/docker-compose.local.yml (Compose 2.24 or newer)
services:
  web:
    ports: !override
      - "127.0.0.1:8080:80"
```

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d
```

A tunnel (Cloudflare Tunnel, Tailscale Funnel, …) works the same way: point it at the `web` service
and keep the public URL in `BETTER_AUTH_URL`.

## 4. First administrator

On every start the api checks whether an account with `ADMIN_EMAIL` exists. If not, it creates it
as an administrator with `ADMIN_PASSWORD` and `ADMIN_NAME` and gives it a personal board ("My
board"). If the account exists, nothing is changed — editing `ADMIN_PASSWORD` later does **not**
reset the password; change it in `/admin` instead.

Sign in at `https://corkspace.example.com/login`, then open `/admin` to create further accounts.
Open sign-up is disabled; every account gets its own board, and board owners invite others as
editors or viewers or create read-only share links.

## 5. Backups

`scripts/backup.sh` writes a Postgres custom-format dump and a tarball of the `assets` volume, and
keeps the newest copies of each.

```bash
bash scripts/backup.sh
```

Defaults (override with environment variables):

| Variable | Default |
|---|---|
| `ENV_FILE` | `infra/.env` (read for `POSTGRES_USER` / `POSTGRES_DB`) |
| `BACKUP_DIR` | `$HOME/corkspace-backups` |
| `DB_CONTAINER` | `corkspace-db-1` |
| `ASSETS_VOLUME` | `corkspace_assets` |
| `RETAIN` | `14` (per kind) |

Output: `db-<YYYYmmdd-HHMMSS>.dump` and `assets-<YYYYmmdd-HHMMSS>.tgz`. The stack must be running.
Schedule it with cron, for example daily at 03:30:

```cron
30 3 * * *  bash /path/to/corkspace/scripts/backup.sh >> /path/to/corkspace-backups/backup.log 2>&1
```

Copy the backup directory off the host as well.

## 6. Restore

```bash
bash scripts/restore.sh ~/corkspace-backups/db-20260101-033000.dump ~/corkspace-backups/assets-20260101-033000.tgz
docker compose -f infra/docker-compose.yml --env-file infra/.env restart api worker
```

**Destructive.** `restore.sh` runs `pg_restore --clean --if-exists --no-owner` into the running
database and replaces the entire contents of the assets volume. It uses the same `ENV_FILE`,
`DB_CONTAINER` and `ASSETS_VOLUME` defaults as the backup script. Rehearse a restore on a test
stack before you need it.

## 7. Upgrading

```bash
bash scripts/backup.sh
git pull
docker compose -f infra/docker-compose.yml --env-file infra/.env build
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
docker compose -f infra/docker-compose.yml --env-file infra/.env ps -a
docker compose -f infra/docker-compose.yml --env-file infra/.env logs migrate
```

The `migrate` service runs on every `up` and applies any new migrations before `api` and `worker`
start; with nothing to do it exits immediately. Check that the containers were actually recreated
(`ps` shows a fresh uptime) and that `migrate` exited with code 0. If a container kept running the
old image, add `--force-recreate` to `up`. Migrations only move forward in production — to roll
back, restore the backup taken before the upgrade.

## 8. Operations notes

- Logs: `docker compose -f infra/docker-compose.yml logs -f api worker`.
- Health: `GET /api/health` returns `200 {"status":"ok","db":"up"}` or `503` when the database is
  unreachable; the `api` container healthcheck uses it.
- The internal nginx re-resolves the `api` container on every request, so restarting `api` does not
  require restarting `web`.
- Login is rate-limited in production (Better Auth).
- To wipe all board content but keep accounts, boards and settings (for example after a demo), run
  the guarded CLI inside the stack — back up first:
  `docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm migrate pnpm --filter @corkspace/db exec tsx src/reset-content-cli.ts --yes`
