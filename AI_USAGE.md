# AI usage record

| Date (IST) | Tool | Task and contribution | Human review | Validation |
| --- | --- | --- | --- | --- |
| 2026-10-24 | Codex | Drafted/refined PRD using user requirements and supplied template documentation | User provided corrections and then authorized implementation | Document structure and source identity checked |
| 2026-10-24 | Codex | Implemented TypeScript foundation, JSON persistence and shared contracts; delegated discovery/integration, staff domain and console in parallel | Pending user review | Per-phase checks recorded in CHANGELOG.md |

OpenAI Docs was used for optional Responses API structured planning. No API key
was configured during foundation development; no live provider test is claimed.
There is no claim that this implementation was built at the template's event.

Phase 1: parallel Codex agents implemented and reviewed discovery/integration, staff
domain and boundary tests. Parent integrated transaction-isolation fixes. Human
review pending. Verified 43 phase tests, typecheck and build before committing.

## Event documentation correction — 2026-10-24T21:53:05+05:30

- Tool: Codex.
- Task: correct the organizer-shared template to Devin Hack Kochi and clarify
  that the event has no major AI usage constraints.
- Affected files: `AGENTS.md`, `AI_USAGE.md`, `CHANGELOG.md`, `PRD.md`, `README.md`, `RULES.md`.
- Human review: pending maintainer review of this pull request.
- Validation: documentation diff, whitespace, and local Markdown link checks;
  no application code changed and no runtime checks were needed.
