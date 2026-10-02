# Security Policy

## Supported versions

Corkspace is developed on `main`; fixes land there. Please update to the latest commit before
reporting.

## Reporting a vulnerability

Please **do not** open a public issue, discussion or pull request for security problems.

Report privately through GitHub's private vulnerability reporting on this repository:
**Security → Report a vulnerability**. Include a description, the commit you tested and steps to
reproduce. You will receive an acknowledgement within **7 days**; a fix or workaround is aimed for
within **90 days** of triage, followed by a GitHub security advisory.

## Scope

In scope: authentication and sessions, board access control (owner / editor / viewer, share
links, the public-only rule for viewers), uploads and image processing, the server-side URL and
link-preview fetching (SSRF guard), rich-text and embed rendering, the container setup.

Worth knowing up front, and not a vulnerability by itself:

- Accounts are created by the admin; there is no public sign-up by design.
- Share links are bearer links: anyone holding the URL sees the board's public entries until the
  owner revokes the link.
- Run it behind a reverse proxy with TLS; over plain HTTP the session cookie travels in clear text.
