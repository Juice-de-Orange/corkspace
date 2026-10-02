# ADR 0006 — Server-side fetching only through an SSRF guard; no arbitrary embeds

## Status

Accepted.

## Context

Link cards, inline link previews in documents and image-by-URL make the server fetch URLs supplied
by users. Without care this is a textbook server-side request forgery hole: requests to loopback
addresses, cloud metadata endpoints, the Docker network or private LAN ranges, either directly,
through a DNS name that resolves there, or through a redirect. Rendering remote content in the
browser has the mirror problem: arbitrary iframes and hotlinked images.

## Decision

- **One fetch function** for all user-supplied URLs: `safeFetch` in
  `packages/shared/src/server/safe-fetch.ts`, exported only from the `@corkspace/shared/server`
  subpath so the web bundle can never import it.
- **Rules** enforced by `safeFetch`:
  - `https:` only;
  - resolve the host and require **every** resolved address to be public — loopback, private,
    link-local, CGNAT, multicast, unspecified, IPv4-mapped IPv6 and numeric-encoding tricks are
    rejected by the pure classifier in `packages/shared/src/security/ip.ts`;
  - connect to the **validated IP** (pinned socket), so DNS rebinding between check and connect does
    not help;
  - follow redirects manually and re-validate every hop;
  - limits on time, body size and allowed content types.
- **Testable by design**: DNS resolution and the HTTPS transport are injected, so the orchestration
  is unit-tested without network access; only the thin Node transport is excluded from coverage.
- **Graceful degradation**: a blocked or failed preview returns just the URL (a bare link card); a
  blocked image download marks the asset `failed`. No error detail about internal targets is
  returned to the client.
- **No arbitrary embeds**: rich text is sanitised (ProseMirror schema plus DOMPurify for rendered
  HTML; the `entry:` scheme is the only extra allowed link scheme). The only iframes are YouTube
  (`youtube-nocookie.com`) and Vimeo players, recognised by the allowlist parser
  `packages/shared/src/video-embed.ts`, rendered with a restrictive `sandbox`, and the nginx CSP
  allows exactly those two `frame-src` hosts.

## Consequences

- Any new feature that fetches a URL must use `safeFetch`; reviewers should reject plain `fetch`
  on user input in `api` or `worker`.
- The IP classifier and `safeFetch` carry adversarial unit tests; the worker and links integration
  tests prove that a loopback target ends as `failed` or as a bare card.
- Allowing another video provider means changing the parser, its tests and the CSP together.
- Previews are fetched once at creation and stored; they do not refresh automatically.
