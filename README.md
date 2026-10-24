# SpaceWorks-Agents

Understand an application, add agent support, and automate **staff operations**
using the application's available capabilities and confirmed operating criteria.

Repository: [SpaceWorks-HQ/SpaceWorks-Agents](https://github.com/SpaceWorks-HQ/SpaceWorks-Agents).
Product intent: [PRD](PRD.md). Build progress: [implementation phases](docs/IMPLEMENTATION.md).

## Stack

Strict TypeScript ESM on Node.js 20+ (Node22 recommended), npm, `zod` and `yaml`.
Vitest and `tsx` are development tools. No database or model SDK is required.
Tests use in-memory state; the CLI uses JSON files and an append-only journal.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Phase 0 delivers the foundation and persistence tests. Staff workflows, local UI,
HTTP endpoints, discovery and provider adapters are being developed in parallel;
their verified status and usage will be updated at subsequent phase checkpoints.

## Principles

- Staff-first: receipts, counts, approvals, issue, return and exception follow-up.
- Offline mode is deterministic and clearly labelled; model configuration is optional.
- Model suggestions cannot change identity, bypass policy or fabricate evidence.
- Existing host services remain authoritative. Reference fixtures are synthetic.
- Discovery and generated changes stay inside the selected authorized root.
- Endpoint generation does not claim completed business-service integration.

## Documentation and provenance

[AGENTS.md](AGENTS.md), [RULES.md](RULES.md), [CHANGELOG.md](CHANGELOG.md),
[AI_USAGE.md](AI_USAGE.md), [SUBMISSION.md](SUBMISSION.md) and the PR template follow
the [DevDay Kochi documentation template](https://github.com/anima-regem/devday-kochi-hackathon-template).
This does not assert participation in that historical event.

License intent: AGPL-3.0-or-later, matching the SpaceWorks ecosystem.
