# Contributing

Read [AGENTS.md](AGENTS.md) and the [development handoff](docs/DEVELOPMENT_HANDOFF.md) first.

- Use existing snapshots for UI features. Don't add game reads to map drawing, item comparisons, tooltips, service searches, phone pairing or update checks.
- Avoid full synchronous copies during play.
- Keep desktop renderer sandboxing and local endpoint restrictions intact.
- Tests must not attach to a live game.
- Keep Mac and Windows icons consistent.
- Don't bump the version unless a release is explicitly requested. See [Releasing](docs/RELEASING.md).
