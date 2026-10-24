# Product requirements: SpaceWorks-Agents

**Version:** 1.1  
**Date:** 24 October 2026  
**Status:** Implementation authorized on 24 October 2026. Staff operations prioritized.
**Implementation status:** See [phase tracker](docs/IMPLEMENTATION.md); requirements below are not claims of completed features.  
**Project repository:** [SpaceWorks-HQ/SpaceWorks-Agents](https://github.com/SpaceWorks-HQ/SpaceWorks-Agents)  
**Documentation template:** [DevDay Kochi hackathon template](https://github.com/anima-regem/devday-kochi-hackathon-template)  
**Application family reference:** [SpaceWorks-HQ repositories](https://github.com/orgs/SpaceWorks-HQ/repositories)

## Project overview

| Template field | Project definition |
| --- | --- |
| Project name | SpaceWorks-Agents |
| Short description | Understand an existing app, build the agent support it needs, ask users for operating criteria, and automate suitable tasks using available capabilities and resources. |
| Intended users | Application maintainers, organization managers, staff and members |
| Team | Not specified; participant information must be supplied by the owner. |
| Technology stack | Undecided; select after inspecting the authorized pilot application. |
| Working demo | Not built; the proposed walkthrough is in section 18. |
| Current status | PRD only; no implemented agent, installed endpoint or enabled workflow. |

The template is used as a documentation reference. Its contribution, validation,
AI-usage and submission structure is mapped in section 18. Template-style project documents and workflow checks are added during implementation. No claim of historical event participation is made.

## 1. Product vision

Create an operations agent that first identifies an application's purpose,
users, workflows and available capabilities. It then uses integration and
development agents to build the support that application needs, asks authorized
users for operating criteria, and automates tasks that fit the app and its
current availability.

The intended sequence is:

**Identify the app → understand its purpose → assess capabilities and availability
→ build missing agent support → gather operating criteria → activate suitable
workflows → act and verify → adapt when capabilities or availability change.**

Inventory is the proposed first demonstration, not the product's only domain:
help a manager set up operating rules, then
help members and staff find items, take consumables, borrow equipment, return
items, and handle related follow-up work.

The product should work across inventory, bookings, machines, events, membership,
workspace operations and other applications through reusable integration patterns
and project-specific adapters. It must discover the actual application rather
than choosing behaviour from the repository name alone, and use the project's
own authentication, permissions and business logic.

**Current delivery scope:** build and test SpaceWorks-Agents inside this folder using parallel workstreams and phase commits. The user has superseded the earlier PRD-only restriction. Sibling application access and live business automation are not authorized by this change.

**Current file-access boundary:** inspect and edit only files in this local
`Agents` folder. The explicitly supplied template is a remote reference. Do not
scan sibling applications, other local folders or external project files in
this task. A future integration needs a maintainer-selected application scope;
this PRD does not grant that access or claim those applications were inspected.

## 2. Problem

Existing applications have useful data and workflows, but people still have to
understand the interface, interpret rules, gather missing information, move
between screens, and check whether work finished. Teams also repeat routine
checks and follow-ups manually.

A general chatbot cannot reliably complete these tasks without understanding
the host application and having a controlled way to perform its operations.
Hardcoded automation also fails when every organization has different criteria.

The product must connect application understanding, agent-assisted development,
conversational configuration of operational rules, and verified execution of
workflows whose capabilities and resources are actually available.

## 3. Product model

The system has six responsibilities. These do not necessarily require six
separate services or models.

| Responsibility | What it does | Authority |
| --- | --- | --- |
| App discovery agent | Identifies purpose, users, data, workflows, stack, available integrations and evidence gaps | Read access inside the explicitly authorized application scope |
| Integration agent | Inspects a selected codebase and adds agent support, endpoints, adapters and tests | Maintainer-authorized repository changes |
| Implementation agent | Builds missing approved operations, UI, policy enforcement and tests; returns validated changes | The integration's approved code-change scope |
| Setup assistant | Asks managers for operating criteria and maps answers to validated policy | Host settings permissions |
| Operations assistant | Understands a user's request and helps complete the appropriate workflow | Authenticated user's permitted actions |
| Recurring operations runner | Performs explicitly enabled checks and follow-ups | Saved workflow authorization and a scoped service identity |

The integration agent changes code during installation or a later authorized
upgrade. The operational agent uses the installed operations; it does not edit
the codebase every time someone asks to borrow an item.

Parallel development agents are authorized for this implementation. Their work remains inside the Agents folder; no other application repository is in scope.

## 4. Users

- **Repository maintainer:** adds agent support without rebuilding the application.
- **Inventory manager:** defines who can do what, under which conditions.
- **Application/domain manager:** configures tasks suited to bookings, machines,
  events, membership, projects or another discovered business purpose.
- **Member or borrower:** finds and obtains items using ordinary language.
- **Desk staff:** handles issue, return, stock receipt and exceptions with guidance.
- **Administrator:** controls access, automation, deployment and operating cost.

## 5. Goals

1. Identify an application's actual purpose and available capabilities, then
   modify it to provide genuine agent support.
2. Ask users for operational criteria instead of assuming universal rules.
3. Turn confirmed criteria into settings enforced by the host application.
4. Complete application-specific actions through existing domain workflows;
   use inventory as the first proposed demonstration.
5. Preserve tenant isolation, approval requirements and physical evidence.
6. Verify results and report the true status of each requested action.
7. Reuse the core approach across different projects and inventory products.
8. Enable recurring work only when its scope and rules are explicitly configured.
9. Build missing support inside an authorized integration rather than merely
   returning suggestions, while distinguishing that work from runtime outages.
10. Adapt task selection to changing resource, service and permission availability.

### Outside the first release

Unrestricted database or shell access from the operations assistant, automatic
payments, unattended hardware control, invented handover evidence, uncontrolled
self-modification, and automatic rollout to every organization repository.

## 6. Journey A: add agent support to a codebase

1. A maintainer selects a repository and authorizes integration work.
2. The integration agent reads repository instructions and inspects the stack,
   authentication, tenancy, roles, settings, APIs, domain services and tests.
3. The discovery agent produces an evidence-backed app profile: what the app is
   for, who uses it, its main workflows and which operations are actually available.
   It asks focused questions where purpose or behaviour remains ambiguous.
4. It prepares an integration plan showing files to change, operations to expose,
   permission mapping, UI entry points, configuration and validation.
5. During a later implementation phase, integration/development agents change
   the selected codebase to add:
   - A versioned operations endpoint and operation discovery.
   - Adapters that call existing domain services.
   - An assistant entry point and a setup/configuration experience.
   - Validated policy persistence and enforcement where the host needs it.
   - Authorization, audit integration and meaningful tests.
   - Missing approved domain operations needed for the selected workflows,
     implemented using the host's existing architecture.
6. It runs the host's required checks and presents a reviewable diff or PR.
7. The maintainer deploys through the application's own release process.
8. An authorized manager confirms the app profile and completes operational
   setup before live automation starts. Only ready, permitted workflows activate.

Creating a route alone does not complete integration. The endpoint must connect
to real application actions, permissions and user workflows. Unsupported stacks
or missing services require explicit integration work, not guessed behaviour.

### 6.1 Application profile and purpose discovery

The discovery agent should determine the following from evidence within the
authorized scope and from targeted questions. It must not collect unrelated
files merely to increase context.

| Profile field | Required finding |
| --- | --- |
| Purpose | The problem the app solves and the outcomes its users expect |
| App/domain type | One or more domains, including mixed/custom apps rather than a forced single category |
| Users and roles | Users, staff, managers, tenants, approval authorities and service principals |
| Main workflows | Real user journeys, their states and the services that own transitions |
| Data and resources | Relevant entities such as items, assets, rooms, jobs, events, memberships or tasks |
| Existing implementation | Framework, routes, domain services, schemas, settings, tests and documented contracts |
| Dependencies | Storage, queues, notifications, payment providers or other connected services |
| Supported operations | Read/write capabilities, permissions, input/evidence needs and verification methods |
| Gaps and uncertainty | Missing features, incomplete implementations, conflicting evidence and unanswered questions |
| Evidence | Allowed source references and confidence for material conclusions |

Use the profile to propose a small set of useful tasks with reasons. Let the
manager correct the interpretation. A repository label or a README claim alone
does not prove that a feature is implemented or currently usable.

### 6.2 Availability means more than stock

| Availability dimension | Examples | Required check |
| --- | --- | --- |
| Implemented capability | Loan request service, booking approval, event roster read | Does a real operation exist and pass its contract checks? |
| Business resource | Available stock, free room slot, machine capacity, event seats | Re-read current host state before committing an action. |
| Dependencies/configuration | Working queue, configured provider, notification credentials | Is the required service configured and reachable? Never infer secrets are present. |
| Authorization | User role, tenant scope, enabled workflow, required approver | Does this actor currently have permission for this action? |
| Operational policy | Opening hours, pickup rules, quantity limits, maintenance window | Does the confirmed policy allow execution now? |

Each task is classified as **ready**, **needs configuration**, **needs
implementation**, **permission restricted**, **temporarily unavailable** or
**not applicable**. Show the reason and supported next step. No readiness state
may be fabricated from model confidence alone.

An unimplemented operation becomes a development task within the authorized
integration scope. A service outage becomes a bounded retry or escalation, not
a reason to rewrite code. Lack of stock becomes an alternative or wait path,
not a fabricated issue. A permission denial never becomes a request for the
agent to grant itself more authority.

### 6.3 Domain-specific task selection

These examples guide discovery; they are not assertions that the referenced
applications currently expose every operation. The present task does not inspect
their local code or install anything in them.

| App purpose | Candidate tasks | Availability that matters |
| --- | --- | --- |
| Inventory and lending | Find items, take consumables, request/issue/return equipment, low-stock follow-up | Actual quantities, asset state, eligibility, handover evidence |
| Space bookings | Find available slots, create requests, follow up pending bookings | Calendar conflicts, holds, approvals, opening hours |
| Machine management | Explain queue delays, prepare job requests, maintenance follow-up | Machine status, queue capacity, consumables, supported adapters |
| Event management | Prepare organiser briefs, registration/check-in support, follow-up tasks | Seats, event state, roster/API permissions, connectivity |
| Membership | Application follow-up, renewal guidance, pending-payment summaries | Membership state, configured plans and verified payment status |
| Team workspace | Create tasks from decisions, identify blockers, prepare status updates | Project access, task state and supported integrations |
| Custom or mixed app | Derive a workflow pack from its actual services and confirmed goals | Capabilities and prerequisites discovered for that app |

The SpaceWorks organization is a candidate application family. A third-party
inventory or unrelated app should receive its own profile and adapter rather
than being forced into SpaceWorks-specific tables or terminology.

## 7. Journey B: ask the manager for criteria

The setup assistant reads existing settings first. It explains what is already
configured, asks only unresolved questions, accepts natural-language answers,
and produces a structured policy draft.

Begin with questions appropriate to the discovered app: which outcomes to
automate, what conditions count as eligible, who can authorize actions, when
work should run, and what should happen when resources or services are unavailable.
Do not ask a bookings manager about consumable limits unless inventory is part
of that application. The following table is the inventory-specific interview.

| Area | Questions the assistant should resolve |
| --- | --- |
| Item types | Which items are consumables, reusable equipment, serialized assets, kits or restricted stock? |
| Eligibility | Who may request, take, approve, issue, return or adjust items? Which existing membership and borrowing restrictions apply? |
| Consumables | Is self-service permitted? What quantities, time windows, purposes or charges apply? |
| Equipment | What loan duration, quantity limits, reservations, approvals and renewal rules apply? |
| Handover | Which scans, photos, remarks or staff confirmations are mandatory? |
| Return | How are condition, partial returns, damaged or lost items handled? |
| Location | Which tenant, room, shelf or bin may each user access? |
| Money | Are there deposits, rental charges or consumable fees? Which existing payment workflow applies? |
| Recurring work | Which checks/reminders are allowed, when, for whom and with what escalation? |
| Control | Who may activate policy, approve exceptions, pause automation and inspect history? |

The assistant must distinguish between rules the host already supports, rules
requiring implementation, conflicting requirements and unanswered questions.
It must not claim that an unsupported criterion is being enforced.

Before activation, show the proposed rules, examples of allowed and denied
actions, affected users and unresolved gaps. Only an authorized manager can
save them. Record the actor, policy version and effective time.

### Setup example

Manager: “Members can take up to five bolts per day themselves. Equipment needs
staff approval and must come back within seven days.”

The assistant checks which settings support those rules and clarifies only
missing details, such as whether the limit is per item or across all bolts,
and which members qualify. It then presents an enforceable policy preview for
confirmation. A missing enforcement capability remains visibly pending.

This is an example, not a policy selected for the product or any existing host.

## 8. Journey C: find and take or borrow items

### Understand the request

Accept an item name, QR scan or project goal. For example: “I need two M3 bolts
and a soldering iron for my project.” Retrieve actual catalogue matches and
explain their availability and permitted next actions. Ask the user to choose
when several items could match.

### Collect missing information

Use the signed-in user's identity, tenant, current settings and item context.
Ask only for required missing details: quantity, purpose/project, pickup
location, dates or a specific serialized asset. Do not repeat manager setup
questions for every member interaction.

### Select the right business operation

| User intent | Meaning | Expected outcome |
| --- | --- | --- |
| Find an item | Search catalogue and check availability | Real matches, location and allowed next actions |
| Request an item | Ask for stock or equipment without claiming possession | Request with its actual approval state |
| Take a consumable | Consume stock through allowed self-service or staff issue | Stock movement and a record reference |
| Borrow equipment | Follow the existing loan and handover lifecycle | Requested, approved or issued loan, as applicable |
| Return an item | Record quantity/asset and required condition evidence | Partial/full return or an exception awaiting staff |
| Add stock | Authorized staff record a real stock receipt | Host receipt and ledger entry |
| Correct stock | Authorized staff record a discrepancy with a reason | Audited adjustment through the existing stock service |

Consumable taking and equipment borrowing must remain different workflows.
Requesting, reserving, approving, issuing and returning are distinct states.

### Check and confirm

Check live availability, user eligibility, quantity limits, existing requests,
approvals, evidence and any payment prerequisites through host services.

Show a summary of the exact items, quantities, location, charges/deposit if any,
due date, remaining requirements and the status that execution will produce.
Get the user's confirmation before an interactive business mutation.

### Execute and verify

Execute with the authenticated actor and a stable action identity. If staff
approval or physical handover is required, create the pending record and guide
the next authorized step. A chat message alone is not physical evidence.

Read back the resulting record. Report actual status, record references and
pickup/return instructions. For a mixed request, report each line separately:
the bolts might be recorded as consumed while the soldering iron is awaiting
approval. Do not claim that all items were issued.

## 9. Journey D: guided return and exception handling

The user identifies a loan or scans an item. The assistant retrieves the real
record, asks for required quantity and condition information, and guides the
existing scan/photo/remarks process. Authorized staff complete any required
inspection or acceptance step.

For a partial return, damage, loss or dispute, use the host's existing incident
and correction workflow. Do not silently mark an item returned, waive charges,
change borrowing eligibility or remove historical evidence.

## 10. Journey E: recurring operations

A manager explicitly enables each recurring workflow with its scope, schedule,
allowed actions, prerequisites, recipients and escalation rules. The selected
workflow pack comes from the app profile. Inventory demonstration candidates:

- Low-stock checks and purchasing-request drafts.
- Overdue loan follow-ups under existing notification policy.
- Pending approval summaries for staff.
- Stock-count discrepancies and exception tasks.

The runner observes current state, selects an allowed next action, executes,
verifies, and finishes or schedules a follow-up. It checks for existing work
before creating another reminder, task or purchasing draft.

Before each action, check the applicable capability, resource, dependency,
permission and policy prerequisites. If availability changes, replan within the
enabled workflow: offer a valid alternative, wait, ask the user, or escalate.
Capability or policy changes invalidate affected assumptions and require
revalidation. Newly discovered operations do not automatically become enabled.

AI handles intent, follow-up questions, criterion interpretation and exceptions.
Deterministic jobs handle ordinary calculations and repeatable reminders.
“Recursive” means a bounded observe–act–verify loop with a stop condition.

## 11. Functional requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| FR-01 | Inspect before integration | Plan identifies host auth, tenancy, services, APIs, tests and gaps. |
| FR-02 | Modify the codebase for real agent support | Later integration includes endpoint, adapter and usable setup/assistant entry point; host checks pass. |
| FR-03 | Ask for operating criteria | Existing settings are read; missing criteria are clarified; a manager reviews the draft. |
| FR-04 | Enforce saved policy | Validated, versioned policy is enforced server-side; unsupported rules remain inactive. |
| FR-05 | Discover permitted actions | Only authorized operations and their validated input requirements are exposed. |
| FR-06 | Act as the correct user | Trusted host authentication establishes actor, tenant and permissions. |
| FR-07 | Find real inventory | Results and availability come from the selected tenant's actual catalogue. |
| FR-08 | Gather and confirm required details | Exact effects and outstanding requirements are shown before interactive mutations. |
| FR-09 | Distinguish consumption and lending | Stock taking and equipment loans use their respective host workflows. |
| FR-10 | Preserve physical evidence | Required scans, photos, remarks and staff confirmation cannot be bypassed. |
| FR-11 | Handle concurrent demand | Host transactions prevent negative stock and conflicting asset issuance. |
| FR-12 | Prevent duplicate actions | Retries and repeated submissions reconcile against a stable action identity. |
| FR-13 | Verify completion | Host records prove outcomes; approval/handover waits remain visibly pending. |
| FR-14 | Audit important changes | Link policy, confirmation, approval and execution to actor, tenant and host records. |
| FR-15 | Bound recurring work | Only enabled workflows run; limits, pause, deduplication and escalation are enforced. |
| FR-16 | Support another inventory product | A second adapter meets the contract using its own roles, schema and services. |
| FR-17 | Identify the application and its purpose | Profile states purpose, users, workflows and evidence; uncertainty can be corrected by a manager. |
| FR-18 | Assess real availability | Tasks distinguish capability, resource, dependency, permission and policy readiness with explicit reasons. |
| FR-19 | Build missing support | Authorized development agents implement selected gaps with host services, tests and a reviewable change; unbuilt work stays marked incomplete. |
| FR-20 | Adapt to the app | Proposed tasks and setup questions follow the discovered domain rather than a fixed inventory checklist. |
| FR-21 | Revalidate when conditions change | A resource conflict, outage or permission change prevents invalid execution and selects a supported fallback. |
| FR-22 | Respect inspection boundaries | Discovery and development use only the explicitly authorized project scope; this planning task accesses no sibling project files. |

## 12. Proposed design decisions

These guide later implementation; they are not claims of implemented features.

1. **Separate installation from operations.** Repository changes happen during
   authorized integration. The runtime has no arbitrary code-editing authority.
2. **Keep the host authoritative.** Adapters call domain services rather than
   introducing parallel stock, loan, payment or audit writers.
3. **Store criteria as policy.** Conversation helps configure validated settings;
   prompts alone do not enforce business rules.
4. **Use real actor and tenant context.** Interactive actions use user authority;
   background actions use narrowly scoped service identities.
5. **Separate three kinds of consent.** Manager policy activation, user action
   confirmation and required staff approval are distinct events.
6. **Use named business operations.** A versioned HTTP contract can expose
   discovery, validated actions and outcome verification. `/api/ops/v1` is a
   proposed namespace, not a finalized or installed route.
7. **Share the contract, adapt each host.** Framework integrations mount endpoints;
   domain adapters map each application's terminology and services. No shared
   database schema or mandatory central SpaceWorks deployment is required.
8. **Make writes retry-safe.** Stable action keys, host transactions and version
   checks prevent duplicate effects and stale confirmations.
9. **Require real evidence.** The assistant guides physical collection/return;
   it cannot fabricate scans, photographs or staff acknowledgement.
10. **Keep normal application use available.** Model or agent outages must not
    prevent staff from using the existing application interface.
11. **Bound execution outside the model.** Enforce tool-call, retry, time and
    spending limits; persist waits and stop/escalation states.
12. **Roll out one project at a time.** Prove one complete inventory flow, then
    portability against a second product before broader integration.
13. **Discover before choosing automation.** Maintain an app profile with evidence
    and uncertainty; do not infer purpose or supported operations from a name alone.
14. **Build and operate through different permissions.** A development agent can
    implement approved gaps; a runtime agent acts only through available operations.
15. **Treat readiness as a runtime condition.** Re-check capabilities, resource
    state, dependency health, permission and policy before execution.
16. **Use the supplied template for documentation.** Keep truthful project,
    validation, AI-usage and submission records; it does not mandate an app stack.

Representative capabilities include catalogue search, availability, policy
preview/update, consumable issue, loan request/issue/return, stock receipt and
operation-status lookup. Each host exposes only what it genuinely supports.

## 13. Failure behaviour

| Situation | Required behaviour |
| --- | --- |
| Ambiguous item or criterion | Ask a focused question; do not guess. |
| Insufficient stock or concurrent change | Re-read state and present valid alternatives. |
| Missing approval, payment or evidence | Leave pending and explain the next permitted step. |
| Material policy change after confirmation | Revalidate and obtain fresh confirmation when needed. |
| Connection loss after submission | Reconcile the original action before retrying; show uncertainty truthfully. |
| Partial success in a mixed request | Show per-line outcomes and do not repeat successful actions. |
| Unauthorized or cross-tenant access | Refuse without exposing another tenant's records. |
| Model unavailable | Existing host interface remains usable. |
| Repeated failure or exhausted budget | Stop or escalate with persisted progress and a clear reason. |
| App purpose is unclear or mixed | Present the inferred profile and ask a focused question before selecting a workflow pack. |
| Needed capability is missing | Mark as needs implementation and prepare/build an approved integration change; do not invoke an imaginary operation. |
| Dependency is unconfigured | Explain required setup and keep dependent tasks inactive. |
| A service is temporarily unavailable | Persist progress and use bounded retry/escalation rather than making unrelated code changes. |

Catalogue descriptions, documents and messages are untrusted data. They cannot
grant permissions or instruct the agent to ignore operating policy. Credentials
and unrelated personal records must stay outside model context.

## 14. Delivery phases for a future implementation

| Phase | Outcome | Exit criterion |
| --- | --- | --- |
| 0 — Planning | This PRD and agreed scope | Owner requests implementation and selects a pilot |
| 1 — Discover and integrate one host | Evidence-backed app profile, real read operations and assistant entry point | Correct purpose, readiness, auth, tenancy and host validation |
| 2 — Guided setup | Criteria interview, policy preview, activation and enforcement | Authorized manager can configure supported rules; members cannot |
| 3 — Interactive inventory | Consumable taking, equipment requests, handover and return | End-to-end flows preserve evidence and verify real records |
| 4 — Recurring operations | Enabled checks/follow-ups with durable progress and controls | Deduplication, pause, retry and escalation work |
| 5 — Portability | Second inventory system and a different app domain | Same contract, independently discovered purposes and domain-specific adapters |

## 15. Acceptance scenarios

1. A manager defines a self-service quantity limit. The assistant clarifies its
   scope, previews it, and saves it only with settings permission.
2. A member cannot change policy or bypass it by instructing the agent to ignore it.
3. A request above the saved limit follows the configured exception route.
4. A mixed consumable/equipment request produces the correct different statuses.
5. Equipment cannot become issued without required approval and handover evidence.
6. Two requests for the final unit cannot both succeed.
7. Retrying after a lost response produces one logical consumption or loan action.
8. Partial returns and damage use existing condition/incident workflows.
9. Another tenant's item identifiers cannot be read or acted upon.
10. Disabling a workflow prevents its next scheduled action.
11. A missing host capability is reported as a gap, never as completed integration.
12. The same supported workflow works in a second inventory product through its adapter.
13. A bookings application is recognized as bookings, and receives appropriate
    slot/approval tasks rather than inventory questions.
14. A mixed-purpose application exposes only its verified capabilities and asks
    for clarification when the intended automation is ambiguous.
15. A missing approved operation is implemented and validated during integration;
    it cannot activate merely because the agent proposed its name.
16. Resource availability changes between planning and execution; the agent
    rechecks and offers a valid alternative or waits without overbooking/overselling.
17. A provider outage is classified separately from missing implementation;
    progress is retained and no duplicate action occurs after recovery.
18. Inspection cannot cross the authorized project boundary. This planning task
    does not inspect any local files outside the Agents folder.

Measure handling time and number of manual steps against a recorded baseline,
verified completion rate, correct escalation, and unauthorized/duplicate action
failures. Numerical performance targets should follow pilot selection and baseline
measurement. No performance result is claimed in this planning document.

## 16. Hackathon fit

The four track names below come from the user's earlier screenshot. They are
positioning options, not rules asserted by the supplied repository template.
That template describes an open-theme DevDay event dated 10–11 October 2026;
using its documentation structure does not claim participation or eligibility.

**Primary: Kill the Busywork.** Demonstrate an actual inventory workflow completed
under configured rules, with less work for members and staff.

**Secondary: Make the Invisible Visible.** Identify stock, overdue or approval
exceptions, explain the evidence, then take a useful permitted next action.

**Works Anyway** applies if the demo includes a real connection failure and safe
recovery. **Make Room for Play** is an optional later community experience rather
than the initial product focus.

## 17. Open choices before implementation

- First authorized pilot application and branch; inventory remains the proposed demo.
- Assistant placement in the existing UI, including scanning and evidence capture.
- Existing host service coverage and required policy/schema changes.
- Real manager, staff and member roles and their exception authority.
- Identity delegation, model/provider, hosting, privacy and cost requirements.
- Exact operation contract, implementation language and framework integration.
- Workflow persistence, scheduling, budgets and production controls.
- Distribution as a reviewed integration process, installer or later GitHub app.
- How the app profile is stored, refreshed and confirmed when the app changes.
- Which capability/dependency checks are authoritative for the selected host.

These choices remain open. This PRD does not install an agent, modify an existing
application, create an endpoint, initialize Git or publish anything.

## 18. Template alignment and proposed demonstration

### Documentation structure

The linked template contains documentation scaffolding, not an application or
a prescribed stack. This PRD uses its project overview, honest status, validation
and demo structure. The following files are **future documentation deliverables**;
they are not being created in this PRD-only task.

| Template document | SpaceWorks-Agents use |
| --- | --- |
| README.md | Project purpose, actual setup/run commands, environment names, implemented features and limits |
| AGENTS.md | Project-local development instructions, authorized scope, validation and accurate status reporting |
| RULES.md | Preserve attribution and distinguish the template event's historical rules from this project's operating rules |
| CHANGELOG.md | Actual changes, reasons, affected files, validation, timestamps and limitations |
| AI_USAGE.md | Actual agent assistance, human review status, checks and corrections |
| SUBMISSION.md | Repository, short description, participants, verified demo, actual checks and final implementation revision when available |

No setup commands, live demo link, test passes or participant details should be
invented. A later template-based repository setup must preserve provenance and
must not label copied documentation as an implementation built at an event.
No GitHub template relationship has been created by updating this PRD.

### Proposed demo walkthrough

1. Select an authorized application; show discovery of its purpose and workflows.
2. Show the capability/readiness report and a short list of suitable automations.
3. Show a maintainer-scoped integration change that builds missing support and
   passes real host checks, clearly separated from business-operation execution.
4. Have a manager answer only the missing operating criteria and activate a
   supported policy with a visible preview.
5. In the inventory example, request consumables and equipment. Show live
   availability, confirmation, correct per-item status and required handover steps.
6. Change a relevant condition such as stock or service availability. Demonstrate
   revalidation, a permitted fallback and verified recovery without duplicate actions.
7. Show that a different app receives a different profile and task selection.

### Planning record

On 24 October 2026, Codex revised this PRD from the user's requirements, the
existing PRD inside the Agents folder and the explicitly linked template's
documentation. The repository URLs were checked for the requested project name.
No sibling application files were inspected during this revision. Product
implementation, runtime validation and human acceptance review remain pending.

### Sources

- [Template README](https://github.com/anima-regem/devday-kochi-hackathon-template/blob/main/README.md)
- [Template agent guide](https://github.com/anima-regem/devday-kochi-hackathon-template/blob/main/AGENTS.md)
- [Template event rules](https://github.com/anima-regem/devday-kochi-hackathon-template/blob/main/RULES.md)
- [Template submission structure](https://github.com/anima-regem/devday-kochi-hackathon-template/blob/main/SUBMISSION.md)
- [Requested project repository](https://github.com/SpaceWorks-HQ/SpaceWorks-Agents)
- [SpaceWorks organization reference](https://github.com/orgs/SpaceWorks-HQ/repositories)
