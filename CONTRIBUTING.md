# Contributing to Corkspace

Thanks for taking the time to contribute! Bug reports, ideas and pull requests are welcome.

Good places to start: issues labelled
[`good first issue`](https://github.com/Juice-de-Orange/corkspace/labels/good%20first%20issue) and
[`help wanted`](https://github.com/Juice-de-Orange/corkspace/labels/help%20wanted). Larger changes
are best discussed in an issue first.

## Before you start

Read [docs/DESIGN.md](docs/DESIGN.md) and the [ADRs](docs/adr/). They explain the invariants a
change has to keep — the camera never re-renders React, world and screen coordinates never mix,
viewers only ever receive public entries, migrations are append-only. [CLAUDE.md](CLAUDE.md) holds
the same rules in the form a coding agent works from.

## Development setup

Node ≥ 22, pnpm 11 (`corepack enable`) and Docker (integration and e2e tests start Postgres
through testcontainers).

```bash
pnpm install
pnpm verify          # focused-test guard, biome, knip, typecheck, unit, integration, build
pnpm test:e2e        # Playwright, desktop + mobile
```

Test layers and coverage gates: [docs/TESTING.md](docs/TESTING.md).

### Secret guard

The repository ships a [pre-commit](https://pre-commit.com/) hook that runs
[gitleaks](https://github.com/gitleaks/gitleaks) on every commit:

```bash
pip install pre-commit && pre-commit install
```

CI runs the same scanner over the full history. Never put real credentials, hostnames or
personal content into any file, test or screenshot — use `.env` and placeholders
(`example.com`, `192.0.2.x`).

## Conventions

- Fork, then branch from `main` (`feat/…`, `fix/…`).
- [Conventional Commits](https://www.conventionalcommits.org/), signed off with the
  [Developer Certificate of Origin](https://developercertificate.org/) (`git commit -s`). No CLA.
- Every UI string goes into the i18n catalog (`apps/web/src/i18n/messages/`) in English and German.
- A schema change is a new migration with a down migration and a test; never edit an applied one.
- A bug fix comes with a test that fails without it.

## License

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
