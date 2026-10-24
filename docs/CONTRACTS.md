# Parallel build contracts

TypeScript strict ESM, Node20+, zod/yaml only runtime deps; Vitest and tsx dev.
All application work stays inside Agents. Parent owns commits and integration.

## Shared types and store

`src/core/types.ts`: Actor `{id,tenantId,role,name}`; roles manager/staff/member.
`StateStore<T>`: `read():Promise<T>` returns a copy, and
`transact<R>(change:(state:T)=>R|Promise<R>):Promise<R>` commits mutated state
only on success, serializing concurrent writes. Root implements MemoryStore and
JsonFileStore. No database. `DomainError` lives in core/errors.ts.

## Domain (domain agent owns src/domain/* and tests/domain*)

Export from src/domain/index.ts:
- `createInitialState(demo?:boolean): OpsState` (demo true seeds synthetic tenant
  `demo`, actors manager-1/staff-1/member-1). No live external data.
- `StaffService(store:StateStore<OpsState>)` with:
  - `snapshot(actor):Promise<StaffSnapshot>`
  - `operations(actor):OperationDefinition[]`
  - `execute(actor,operation,input,{actionKey,confirmed}):Promise<OperationResult>`
- `StaffSnapshot`: items,requests,loans,tasks,activity lists, policy object.
- Item: id,name,kind(consumable/equipment),onHand,available,reorderPoint,location,qr.
  Loan: id,itemId,itemName,memberId,quantity,status,dueAt.
  Request: id,itemId,itemName,memberId,quantity,status.
  Task: id,kind,title,status,subjectId.
- Policy: version,selfService,consumableDailyLimit,loanDays,requireScan,
  requireReturnRemarks,automationEnabled.
- Operations and inputs (camelCase):
  inventory.consume {itemId,quantity,purpose}; stock.receive {itemId,quantity,reason};
  stock.adjust {itemId,delta,reason}; lending.request {itemId,quantity,memberId,dueAt};
  lending.approve {requestId}; lending.issue {requestId,scan,remarks};
  lending.return {loanId,scan,remarks,condition};
  policy.update {criteria,expectedVersion}; tasks.complete {taskId,remarks};
  automation.run {}. Staff can consume/receive/adjust/approve/issue/return;
  manager can also update policy. Members only self consume under policy and
  request their own loans; snapshots/authorization enforce tenant/actor scope.
- All mutations require confirmed true, stable actionKey, scoped idempotency and
  transactionally persisted result/audit. Validate zod strict input, quantity,
  stock, loan availability and scan proof. Returned equipment with damage must
  be quarantined rather than silently available. Recurring tasks deduplicate and
  pause via policy; no emails or external notifications sent in this version.

## Discovery (discovery agent owns src/discovery/*, src/integration/*, their tests,
## and synthetic examples/apps/* fixtures only)

- `inspectApp(path:string,allowedRoot:string):Promise<AppProfile>` exported from
  src/discovery/index.ts. Profile purpose,domains,framework,capabilities,gaps,
  recommendedTasks,evidence (typed JSON). Capability evidence not inferred only
  from README claims. Bounded scanning, no secrets or symlink escape.
- `planIntegration(path,allowedRoot):Promise<IntegrationPlan>` and
  `applyIntegration(path,allowedRoot,planHash):Promise<...>` from integration/index.ts.
  Plan JSON includes planHash,files[{path,content}],readiness,instructions.
  Next.js additive endpoint /api/ops/v1; auth required, domain connection pending.
  Revalidate hash/collisions/symlinks on apply; no fabricated domain integration.

## HTTP and UI (UI agent owns web/* and tests/ui* if needed)

Every /api endpoint requires bearer token from sessionStorage. Server resolves
Actor; no actor override from input. Error {error:{code,message}}. Static local
UI has no external scripts, fonts or dependencies. Distinct synthetic demo label.

- GET /api/session -> {actor,mode,provider:{configured,name}}
- GET /api/staff -> StaffSnapshot
- GET /api/operations -> {operations:OperationDefinition[]}
- POST /api/operations/:name -> {input:{...},actionKey,confirmed:true}
- POST /api/chat -> {message} -> {reply,proposals:Proposal[],provider}
- POST /api/discovery -> {path} -> AppProfile
- POST /api/integration/plan -> {path} -> IntegrationPlan
- POST /api/integration/apply -> {path,planHash,confirmed:true} -> written files

UI: login token field, staff overview; inventory actions including requests,
issue/return/receive/count corrections; tasks/automation; manager criteria;
assistant chat with explicit confirmation per proposal; app discovery/integration.
Actor roles drive controls and backend enforces them. Preserve action keys across
retries of unknown outcomes; no innerHTML of untrusted data. Root owns server,
CLI, stores, assistant/providers, config and HTTP tests.
