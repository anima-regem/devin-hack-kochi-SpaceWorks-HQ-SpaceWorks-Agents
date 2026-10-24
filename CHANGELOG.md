# Change log

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
