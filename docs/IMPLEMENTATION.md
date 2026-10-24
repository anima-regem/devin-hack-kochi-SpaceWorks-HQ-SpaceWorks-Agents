# Implementation phases

## Phase 0 — foundation

TypeScript strict ESM, Node20+, shared contracts, YAML configuration, memory/file
stores, append-only journal and DevDay-style documentation. Foundation checks
must pass before the phase commit.

## Phase 1 — staff workflows and app integration

Parallel tracks: staff inventory domain; evidence-based discovery and scoped
endpoint generation. Validate permission/tenant isolation, confirmation,
idempotency, stock/loan/evidence rules, policy and recurring task deduplication.

## Phase 2 — usable staff console and assistant

Authenticated local HTTP UI, identity mapping, manager criteria, issue/return/
stock desk, task queue and deterministic assistant. Optional OpenAI/Anthropic
planning over plain HTTPS; no SDK or key required for offline operation.

## Phase 3 — integration checks and delivery

HTTP acceptance tests, browser walkthrough, disk restart checks, fresh build,
phase documentation, commit/push and CI inspection. Keep gaps explicit: no
sibling apps touched, no generic completed business integration claims, no
unverified live provider calls and no real outbound notifications.
