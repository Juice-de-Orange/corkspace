# Running a public demo

`DEMO_MODE=on` turns an instance into a try-it-yourself demo that anyone on the internet can open
without an account. Every visitor gets a **private copy of a seed board**; nobody sees what another
visitor does, and the whole instance returns to the seed state every hour. It is meant for a small
VPS behind a tunnel or reverse proxy, next to (not instead of) your real instance.

With `DEMO_MODE` unset or `off` (the default) none of this is active.

## What a visitor gets

- A banner on every page: *"Demo — data resets every hour. Do not enter personal data."*
- No sign-in form: opening the site creates a guest account with its own board, a copy of the demo
  board (a trip, a recipe and a small project, tied together with red threads). The guest can do
  everything a board owner can do on that board: notes, documents, checklists, threads, drawing,
  frames, teleports, tags, search, history, export.
- Signing out and opening the site again starts a new guest with a fresh copy.

## What is switched off, and why

Each of these is refused by the server — not only hidden in the UI — with HTTP 403 and
`{"code": "DEMO_DISABLED"}`:

| Feature | Why |
|---|---|
| Sign-in with e-mail and password, sign-up, password reset and change, e-mail change and verification, the Better Auth admin endpoints | There are no accounts in a demo; guests are created by `POST /api/demo/session`. Only `GET /api/auth/get-session` and `POST /api/auth/sign-out` are allowed. |
| The admin area (`/api/admin/*`) and feedback (`/api/feedback`) | Nobody administrates a demo; feedback would store visitor content for someone else to read. |
| Image uploads and remote images (`POST /api/boards/:id/assets`, `…/assets/from-url`) | Visitors could store arbitrary files; remote downloads are a server-side request surface. |
| Link previews (`/api/links/*`) | A server-side fetch of a URL the visitor chooses (SSRF surface). Link cards still work with the URL and a title typed by hand. |
| Invitations (`…/members`) and read links (`…/shares`) | Both would show one visitor's content to someone else. |

In addition, `docker-compose.demo.yml` puts the api on a network **without internet access**, so
even a bug in one of these guards could not make the server fetch anything from outside.

Search engines are kept out: every answer carries `X-Robots-Tag: noindex, nofollow` and
`/robots.txt` disallows everything.

## Limits

| Variable | Default | What happens above it |
|---|---|---|
| `DEMO_RATE_LIMIT` | `240` | Requests per client address and minute; then 429 `RATE_LIMITED` with `Retry-After`. `/api/health` is exempt. |
| `DEMO_GUESTS_PER_IP` | `20` | New guest boards per client address and hour; then 429. |
| `DEMO_MAX_GUESTS` | `500` | Guest boards in total until the next reset; then 503 `DEMO_FULL`. |
| `DEMO_MAX_OBJECTS` | `200` | Objects per board (entries incl. the trash, threads, strokes, frames, teleports, tags); then 403 `DEMO_LIMIT`. |
| `DEMO_MAX_BODY_BYTES` | `16384` | Size of one request body, which bounds every text a visitor can save at once; then 413 `DEMO_LIMIT`. |
| `DEMO_MAX_DB_MB` | `1024` | Size of the whole database; above it every write answers 503 `DEMO_FULL` until the next reset (checked every 30 s). |
| `DEMO_CLIENT_IP_HEADER` | `x-real-ip` | The header the limits read the client address from (see below). |

The limits are kept in the memory of the single api process; restarting the api resets them.

### The client address behind a tunnel

The bundled nginx sets `X-Real-IP` to the address that connected to it. Behind a tunnel or proxy on
the same host that is always the tunnel, so every visitor would share one rate limit. Set
`DEMO_CLIENT_IP_HEADER` to the header your tunnel sets to the real visitor address and that a
visitor cannot forge — for a Cloudflare Tunnel `CF-Connecting-IP`. Only do this when the demo port
is reachable through that tunnel alone (the compose file binds it to `127.0.0.1`).

## Run your own demo

You need Docker with Compose and a hostname that a tunnel or reverse proxy forwards to
`127.0.0.1:${DEMO_PORT}` (default 8090).

```bash
git clone https://github.com/Juice-de-Orange/corkspace.git && cd corkspace
umask 077
cat > infra/.env.demo <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
BETTER_AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
ADMIN_PASSWORD=$(openssl rand -hex 16)
DEMO_URL=https://demo.example.com
DEMO_CLIENT_IP_HEADER=CF-Connecting-IP
ENV
docker compose -f infra/docker-compose.demo.yml --env-file infra/.env.demo up -d --build
```

`DEMO_URL` is the address visitors open (Better Auth checks it). For a local try use
`DEMO_URL=http://localhost:8090` and leave `DEMO_CLIENT_IP_HEADER` out. All `DEMO_*` limits above
can be set in the same file; `DEMO_PORT` changes the published port.

The stack (Compose project `corkspace-demo`) runs `db`, `migrate`, `api`, `web` and `reset`:

| Service | Memory | CPU | Notes |
|---|---|---|---|
| `db` | 256 MB | 0.5 | Postgres 16, `max_connections=40`, its own volume |
| `migrate` | 256 MB | 0.5 | one-shot |
| `api` | 384 MB | 1.0 | runs as user `node`, no capabilities, no internet |
| `reset` | 256 MB | 0.5 | the hourly scheduler (below) |
| `web` | 64 MB | 0.5 | nginx, the only published port (`127.0.0.1` only) |

Every service has a process limit and rotates its logs at 10 MB × 3 files. There is no `worker`:
without uploads and remote images it would have nothing to do.

## Reset

`demo-reset` (a command in the api image) removes every guest — accounts, boards, content and
sessions — and rebuilds the demo board from the seed that ships in the image. It refuses to run
unless `DEMO_MODE=on`.

```bash
docker compose -f infra/docker-compose.demo.yml --env-file infra/.env.demo exec api demo-reset
```

The `reset` service runs it on every full hour (`DEMO_RESET_INTERVAL`, default 3600 seconds). The
new demo board is built first and swapped in together with the deletion of the guests in one
transaction, so the site stays up and healthy throughout; a visitor whose guest was removed gets a
fresh copy on the next page load.

## What remains a risk

- **Content visitors type** is visible only to themselves, but it is stored until the next reset.
  The banner asks visitors not to enter personal data; the operator of a public demo is still
  responsible for what it hosts (legal notice and privacy statement are not part of this mode).
- **Storage** is bounded per board (objects × body size, plus up to 20 versions per entry) and in
  total by `DEMO_MAX_DB_MB`; a determined visitor with many addresses can fill the demo until the
  next reset, but not the disk of the host beyond that cap.
- **Rate limits are per address.** Many addresses (a botnet, IPv6 ranges) get many budgets; the
  container CPU and memory limits are the last line.
- **Guest sessions are cookies.** A visitor who clears cookies starts a new guest (counted against
  `DEMO_GUESTS_PER_IP`).
