# Change log

## 2026-10-24T21:53:05+05:30 — Correct Devin Hack Kochi event guidance

- Changed: corrected the current event name and AI tool guidance in `AGENTS.md`, `AI_USAGE.md`, `CHANGELOG.md`, `PRD.md`, `README.md`, `RULES.md`.
- Why: the organizer shared an older event template; Devin Hack Kochi has no
  major AI usage constraints and the template must not require a particular AI provider.
- Scope: preserved project implementation and historical assistance records.
- Validation: reviewed documentation diffs, checked whitespace with `git diff --check`, and checked local Markdown links for new breakage.
- Limitations: maintainer review is pending; application tests were not run for this documentation-only correction.

## 2026-10-24T21:41:14+05:30 — Phase 1: staff workflows and scoped integration

- Changed: Implemented inventory catalogue/receipts/corrections, consumable taking,
  equipment requests/approval/scan handover/returns, damage quarantine, versioned
  manager criteria, staff task generation and actor-scoped idempotency.
- Changed: Added bounded purpose/capability discovery and additive authenticated
  Next.js endpoint generation with stale-plan, collision and scope checks.
- Changed: Fixed transaction result/draft isolation and identity validation/races.
- Validation: 43 foundation/domain/discovery/integration tests passed; strict
  typecheck and production build passed. Generated endpoint was executed in tests.
- Limitations: Discovery matches remain unverified until connected to host services;
  generated host business operations stay disabled pending integration. Staff
  consumption limits use UTC dates. No external notifications or sibling edits.

## 2026-10-24 — Phase 0: TypeScript foundation

- Changed: Initialized the repository; added strict TypeScript/ESM configuration,
  shared actor/error/store contracts, YAML config, in-memory transactions and
  disk JSON storage backed by an append-only hash-linked journal.
- Why: Establish the bounded, durable base for parallel staff-operations work.
- Validation: 6 foundation tests passed; TypeScript typecheck and production build passed.
  npm audit reported zero vulnerabilities after updating the test runner.
- Limitations: No staff console or connected host integration at this checkpoint.
  A torn/corrupt journal fails closed and requires verified recovery; stale lock
  files are not removed automatically. No database is used.

## 2026-10-24 — Product planning

- Changed: PRD covering purpose discovery, integration, manager criteria,
  availability, inventory workflows and template alignment.
- Validation: Document structure and requested repository identity checked.
- Limitations: Planning did not claim implementation or a working demo.
