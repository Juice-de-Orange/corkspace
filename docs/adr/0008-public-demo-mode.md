# ADR 0008 — Public demo mode with guest accounts

## Status

Proposed.

## Context

Strangers want to try Corkspace before they install it. A shared demo account would let every
visitor see and change what the others typed — including anything offensive or personal — and a
public sign-up contradicts ADR 0004 (accounts are created by administrators). A demo is also an
internet-facing service run on a small host, so every feature that stores files, sends mail or
fetches URLs on the server is an abuse surface there.

## Decision

- **`DEMO_MODE=on` is a separate mode of the same build**, off by default. When off, none of its
  middleware or routes is mounted (`buildApp`), and `/api/instance` answers exactly as before.
- **Guests instead of sign-up.** `POST /api/demo/session` creates a guest account
  (`guest-<uuid>@demo.invalid`, random password nobody knows) with its own board, copies the
  **template board** into it in one repeatable-read transaction, and signs it in through Better
  Auth. The board-scoped access model (ADR 0004) is unchanged: a guest owns exactly one board and
  has no other access.
- **The template board** belongs to `template@demo.invalid` and is built from the same seed as
  `pnpm db:seed-demo`, in-process through the real routes. The seed in the image is the snapshot.
- **Refusals are server-side**, in one gate before Better Auth: an allow-list for `/api/auth/*`
  (session read and sign-out only), and `DEMO_DISABLED` for the admin area, feedback, link
  previews, uploads, remote images, invitations and read links.
- **Limits** per client address (requests, new guests), per board (objects), per request (body)
  and per instance (guests, database size), configurable through `DEMO_*` variables.
- **Reset** (`demo-reset`, hourly in `docker-compose.demo.yml`): build a new template, then delete
  all guests and swap the template in one transaction under an advisory lock.

## Consequences

- ADR 0004's "no open sign-up" holds for every normal instance; the demo's guests can only ever
  reach their own copy, and they vanish at the next reset.
- The demo cannot show uploads, link previews, sharing or the admin area; `docs/demo.md` lists what
  is off and why.
- Rate-limit state lives in the memory of the single api process; a horizontally scaled demo would
  need a shared store.
