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
| `web` | `infra/Dockerfile.web` | nginx serving the built SPA and proxying `/api/` to `api`; runs as the unprivileged user `nginx` (uid 101) and listens on 8080 inside the container, published on `${WEB_PORT}` (default 8080) |

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
| `BRAND_NAME` | no | Name of your instance in the header, on the sign-in page, in the browser tab and in export file names, default `Corkspace`. Read by the api at start; restart `api` after changing it. |
| `COMPOSE_PROJECT_NAME` | no | Compose project name, default `corkspace` (from the compose file). It prefixes container, volume and network names; the backup scripts follow it. |
| `WEB_PORT` | no | Host port of the `web` service, default 8080. |
| `TRUSTED_PROXIES` | no | Addresses/CIDRs (space or comma separated) allowed to tell the `web` nginx the client address; default loopback and the private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`). `none` trusts nobody. See §3. |
| `REAL_IP_HEADER` | no | Header those proxies put the client address in, default `X-Forwarded-For`; `CF-Connecting-IP` behind a Cloudflare Tunnel. |

`DATABASE_URL` is composed automatically inside the stack; set it only when you run the api or
worker outside Compose. `API_PORT`, `ASSET_DIR` and `NODE_ENV` are fixed by the compose file. The
`SMTP_*` variables are accepted by the configuration schema but not used yet — there are no
outgoing emails (see "Known limitations" in the README); administrators set new passwords in
`/admin`.

Never commit `infra/.env`; it is ignored by `.gitignore`.

## 2. Start

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.yml --env-file infra/.env ps -a
curl -fsS http://localhost:8080/api/health    # {"status":"ok","db":"up"}
```

`migrate` should show `Exited (0)`; `db`, `api` and `web` should be `healthy`. Until `api` is healthy, `/api/`
requests return 502 for a few seconds.

## 3. Put a reverse proxy with TLS in front

Point the proxy at `http://localhost:${WEB_PORT}`. Requirements:

- **HTTPS is mandatory.** In production the session cookies are `Secure`, so login does not work over
  plain HTTP. `BETTER_AUTH_URL` and `AUTH_TRUSTED_ORIGINS` must match the public `https://` origin.
- Allow request bodies of **at least 12 MB** (image uploads, feedback screenshots).
- Forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`.
- If a CDN sits in front, do not cache `index.html`; everything under `/static/` is content-hashed
  and safe to cache forever.

**Client address and the sign-in limit.** Sign-in is limited to 3 attempts per 10 seconds per client
address. The `web` nginx works out that address and passes it to the api as `X-Real-IP` (always
overwritten, so a visitor cannot pick it). It takes the address from `REAL_IP_HEADER`
(`X-Forwarded-For` by default) only when the connection comes from `TRUSTED_PROXIES`, and walks the
header from the right, skipping trusted hops, so a value a visitor puts at the front is ignored. The
default trusts loopback and the private ranges, where a proxy on the same host (through Docker's
bridge) or a tunnel container connects from; Caddy and the nginx example below need no change.
Narrow `TRUSTED_PROXIES` to your proxy's address if untrusted machines on a private network can
reach `WEB_PORT` directly, since anything that is trusted can claim any client address. Behind a
Cloudflare Tunnel set `REAL_IP_HEADER=CF-Connecting-IP`. If the address is wrong, every visitor
shares one limit and a failed-login burst blocks sign-in for everyone for a few seconds.

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
      - "127.0.0.1:8080:8080"
```

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.local.yml --env-file infra/.env up -d
```

A tunnel (Cloudflare Tunnel, Tailscale Funnel, …) works the same way: point it at the `web` service
on port **8080** (for example `http://corkspace-web-1:8080` from a container on the same network)
and keep the public URL in `BETTER_AUTH_URL`.

## 4. First administrator

On every start the api checks whether an account with `ADMIN_EMAIL` exists. If not, it creates it
as an administrator with `ADMIN_PASSWORD` and `ADMIN_NAME` and gives it a personal board ("My
board"). If the account exists, nothing is changed — editing `ADMIN_PASSWORD` later does **not**
reset the password; change it in `/admin` instead.

**Locked out?** There is no e-mail reset. If the only administrator has lost the password, create a
second administrator the same way: set `ADMIN_EMAIL` to an address that has no account yet and
`ADMIN_PASSWORD` to a new password in `infra/.env`, then
`docker compose -f infra/docker-compose.yml --env-file infra/.env up -d` (the api is recreated and
creates that account on start). Sign in with it, set a new password for the old account under
**Admin → Users**, sign in with the old account, delete the helper account there, and put the old
`ADMIN_EMAIL` back into `infra/.env` — otherwise the next start creates the helper account again.

Sign in at `https://corkspace.example.com/login`, then open `/admin` to create further accounts.
Open sign-up is disabled; every account gets its own board, and board owners invite others as
editors or viewers or create read-only share links.

## 5. Backups

`scripts/backup.sh` writes a Postgres custom-format dump and a tarball of the `assets` volume, and
keeps the newest copies of each.

```bash
bash scripts/backup.sh
```

The scripts find the containers and the assets volume through Compose
(`docker compose -f infra/docker-compose.yml --env-file infra/.env ps`), so they follow the project
name, including `COMPOSE_PROJECT_NAME` set in `infra/.env`. If you start the stack with `-p <name>`
on the command line instead, export `COMPOSE_PROJECT_NAME=<name>` for the scripts as well.

Defaults (override with environment variables):

| Variable | Default |
|---|---|
| `ENV_FILE` | `infra/.env` (read for `POSTGRES_USER` / `POSTGRES_DB` and the project name) |
| `BACKUP_DIR` | `$HOME/corkspace-backups` |
| `DB_CONTAINER` | the `db` container of the compose project (`corkspace-db-1` if none is found) |
| `ASSETS_VOLUME` | `<project>_assets`, e.g. `corkspace_assets` |
| `RETAIN` | `14` (per kind) |

The backup stops with an error if the assets volume does not exist, instead of archiving an empty
volume.

Output: `db-<YYYYmmdd-HHMMSS>.dump` and `assets-<YYYYmmdd-HHMMSS>.tgz`. The stack must be running.
Schedule it with cron, for example daily at 03:30:

```cron
30 3 * * *  bash /path/to/corkspace/scripts/backup.sh >> /path/to/corkspace-backups/backup.log 2>&1
```

Copy the backup directory off the host as well.

## 6. Restore

```bash
bash scripts/restore.sh ~/corkspace-backups/db-20260101-033000.dump ~/corkspace-backups/assets-20260101-033000.tgz
```

**Destructive.** `restore.sh` runs `pg_restore --clean --if-exists --no-owner` into the running
database and replaces the entire contents of the assets volume. Before it changes anything it
checks that both files exist, that `pg_restore` can read the dump and that the tarball lists; if
not, it stops with "nothing was changed". It then stops the `api` and `worker` containers, restores,
and starts them again (also when the restore fails half-way), so the instance answers 502 for the
duration. It finds the containers and the volume the same way as the backup script (same
`ENV_FILE`, `DB_CONTAINER` and `ASSETS_VOLUME` overrides), plus `API_CONTAINER` and
`WORKER_CONTAINER` for the `api` and `worker` services; if it finds neither running, it says so and
you restart them yourself afterwards. Rehearse a restore on a test stack before you need it.

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
- Health: `GET /api/health` returns `200 {"status":"ok","db":"up"}` or
  `503 {"status":"degraded","db":"down"}` when the database is unreachable; the `api` container
  healthcheck uses it.
- If Postgres restarts or is briefly unreachable, `api` and `worker` keep running: the api answers
  503 on `/api/health` and cannot serve board data, the worker logs `queue unavailable, retrying`
  every few seconds, and both reconnect on their own. Only at start-up do they need the database:
  started without it, they exit and Docker restarts them until it is there.
- The internal nginx re-resolves the `api` container on every request, so restarting `api` does not
  require restarting `web`.
- Login is rate-limited in production (Better Auth), per client address — see §3.
- To wipe all board content but keep accounts, boards and settings (for example after a demo), run
  the guarded CLI inside the stack — back up first:
  `docker compose -f infra/docker-compose.yml --env-file infra/.env run --rm migrate pnpm --filter @corkspace/db exec tsx src/reset-content-cli.ts --yes`
