# SpaceWorks-Agents development guide

Read PRD.md and docs/CONTRACTS.md. User has authorized parallel implementation,
phase commits and tests; the old planning-only wording is superseded. The latest
priority is automating staff operations, not only member self-service.

- Work inside this Agents folder only. No sibling application reads or writes.
- TypeScript strict ESM, Node20+, npm; zod/yaml only at runtime; Vitest/tsx dev.
- In-memory tests; JSON state and append-only disk logs for CLI. No database.
- Model providers use plain HTTPS; no SDK. Offline deterministic mode is usable
  with no key. Do not claim live provider verification without an actual call.
- Server auth supplies actor/tenant; model output and request bodies cannot.
- Existing host domain services own business state. Reference demo is synthetic.
- Preserve scans/remarks, approvals, stock constraints and audit. Transactions
  and persisted idempotency prevent repeated submissions from duplicating effects.
- Discovery uses evidence and marks unknown/missing capabilities. Generated
  endpoints do not imply completed domain integration.
- Installer previews, refuses collisions and only writes in authorized scope.
- Runtime operations have no arbitrary shell/SQL/source-writing capability.
- Keep modules focused, preferably below 300 lines. Do not commit secrets/state.
- Parallel agents own separate modules and never commit. Parent integrates/tests.
- Before a phase commit run npm run check and update CHANGELOG.md / AI_USAGE.md.
- Follow the supplied documentation structure for Devin Hack Kochi without claiming
  unverified participation, eligibility or a demo that does not exist. The event has
  no major AI usage constraints; the template requires no specific tool or provider.
