# Backend

Both Docker Compose and a host-based Nest development server are supported.
From the repository root, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Start the full Docker stack:

```bash
docker compose up --build
```

To run Nest on the host while PostgreSQL runs in Docker, start only the
database and migrations, then start Nest in another terminal:

```bash
docker compose up -d postgres migrate
cd backend && npm run start:dev
```

The host-based API listens on `http://localhost:3002` by default; set
`LOCAL_PORT` to use another port. Docker publishes its API on port 3001 and
PostgreSQL on `127.0.0.1:5436`, so both API runtimes can run at the same time.

The API listens at `http://localhost:3001`. Swagger UI is at
`http://localhost:3001/api/docs`, and readiness is checked at
`http://localhost:3001/api/health`. The health endpoint checks the API and a
real PostgreSQL query; unavailable dependencies return HTTP 503 without
database details.

## HTTP behavior

The global `ValidationPipe` transforms DTO values, rejects unknown properties,
and formats validation failures through the global exception filter. Error
responses use this shape (with `details` only for validation errors):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [{ "field": "name", "constraints": ["name should not be empty"] }],
  "correlationId": "8f4e286a-58ca-4b07-8b6f-e0f5e443a4ae",
  "timestamp": "2026-10-20T16:30:00.000Z",
  "path": "/api/example"
}
```

The API accepts a client `X-Correlation-ID` only when it is a canonical UUID
(hexadecimal `8-4-4-4-12`, UUID version 1–8 and RFC variant). Otherwise it
generates a UUID v4. The ID is returned in the response header, included in
HTTP logs, and included in standardized error responses. Concurrent requests
use independent request context from `pino-http`.

## CORS, security, and logs

`CORS_ORIGINS` is a comma-separated allowlist of exact HTTP or HTTPS origins;
it defaults to `http://localhost:3000`. Wildcards, paths, and non-HTTP schemes
are rejected by Joi. CORS does not enable credentials. It allows the
`X-Correlation-ID` request header and exposes the response header to browsers.

Helmet applies its standard security headers. Swagger UI needs inline bootstrap
code, so only `/api/docs` receives a narrowly scoped CSP exception for inline
scripts and styles; other Helmet protections remain active.

Pino emits JSON logs and is installed as NestJS's logger. `LOG_LEVEL` accepts
`fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` (default
`info`). HTTP completion logs contain method, URL path without its query,
status, duration, and correlation ID. Healthcheck request completion logs are
suppressed. Request/response bodies are not logged; Authorization, Cookie, and
Set-Cookie headers are omitted or redacted. 5xx access records include status
and duration without a synthetic stack. Unexpected exceptions receive one
separate Pino error record with the native `err` field, error class, method,
path, status, and Correlation ID. Messages and stacks are scrubbed for
connection strings, authorization/cookie values, credential-like fields,
JWTs, query values, email addresses, and payload/body markers before logging;
diagnostic strings are also length-limited. The HTTP 500 response remains
generic and never includes the diagnostic message or stack.

## Environment

The root `.env.example` configures both local modes. `DATABASE_URL` points the
host-based Nest process to PostgreSQL's loopback-published port; Compose builds
an internal URL using the `POSTGRES_*` values and the `postgres` service name.
Keep the password and database settings in both values aligned when changing
the defaults. The Compose source variables are:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode (`development`, `test`, or `production`) |
| `PORT` | API listen port inside the container |
| `LOG_LEVEL` | Pino threshold |
| `CORS_ORIGINS` | Exact comma-separated browser origin allowlist |
| `FOLLOW_UP_EVALUATION_INTERVAL_MS` | Automation interval in milliseconds (default 900000) |
| `FOLLOW_UP_STALE_CONTACT_DAYS` | Inactivity window in UTC calendar days (default 7) |
| `FOLLOW_UP_CUSTOMER_EVENT_WINDOW_DAYS` | Customer event window in calendar days (default 7) |
| `POSTGRES_HOST` | Compose hostname used to construct the connection URL |
| `POSTGRES_PORT` | PostgreSQL port inside the Compose network |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | Local PostgreSQL password |
| `POSTGRES_HOST_PORT` | Loopback host port published for PostgreSQL (default `5436`) |
| `BACKEND_HOST_PORT` | Loopback port published on the host |

Compose constructs the backend's container `DATABASE_URL` from `POSTGRES_*`.
The host-based Nest process loads `DATABASE_URL` from the root `.env` file.
Credentials containing reserved URL characters must be URL-encoded. The
application validates environment configuration with Joi and reports invalid
variable names without printing values.

## Opportunities API

The initial opportunities migration is
`prisma/migrations/20261020150000_initial_opportunities`. It creates
`Salesperson`, `Opportunity`, `OpportunityItem`, the six-stage enum, business
constraints, lookup indexes, and a database sequence for generated commercial
codes. PostgreSQL stores money as `DECIMAL(14,2)`, and the API sends it as a
decimal string.

| Method and path | Behavior |
| --- | --- |
| `GET /api/opportunities` | Search code/company and filter by stage or salesperson; sort and paginate. |
| `GET /api/opportunities/:id` | Return an active opportunity with its items and salesperson. |
| `POST /api/opportunities` | Create in `PRIMEIRO_CONTATO`; the server assigns its code. |
| `PATCH /api/opportunities/:id` | Update commercial fields; include the current `version`. If `items` is sent, it replaces the current item list in the same transaction. |
| `PATCH /api/opportunities/:id/stage` | Move the opportunity through the validated pipeline and append one history row in the same PostgreSQL transaction. |
| `GET /api/opportunities/:id/history` | Return registered stage movements in chronological order. |
| `DELETE /api/opportunities/:id` | Set `deletedAt`; repeated requests keep the original timestamp. |
| `GET /api/salespeople` | List available salespeople. |

Swagger UI is available at `/api/docs`. Unknown request properties are rejected,
so `stage` cannot be changed through create or patch. The next branch should add
the dedicated transition endpoint before enabling stage updates.

### Logical deletion

`Opportunity.deletedAt` is nullable and was included in the first migration.
The delete endpoint never physically removes an opportunity. A database unique
constraint keeps its `code` reserved, and `ON DELETE RESTRICT` foreign keys
prevent physical deletion of an opportunity with items or a salesperson still
referenced by opportunities. Items stay attached to soft-deleted opportunities.
There is no restoration endpoint.

Every current opportunity read includes `deletedAt: null`; future pipeline,
activity, and automation queries must apply the same predicate. Compound indexes
on `(stage, deletedAt)` and `(salespersonId, deletedAt)` support these filtered
reads. Do not use physical cascades when adding future relationships: history and
activity records must remain referentially safe.

### Case seed and source decisions

The source is `Case_Tecnico_Dev_Full_Stack_Pleno_Grupo_Nobre.pdf` (two pages,
data reference 15/10/2026). The seed imports OPP-2001 through OPP-2007, all
listed companies, stages, sellers, one listed gift item and quantity per row,
estimated values, last contacts, proposal validity, and customer event dates.
It creates the three listed sellers Ana, Bruno, and Carla. OPP-2001 has an
intentionally blank proposal validity date. The case does not provide a loss
reason for OPP-2007 or a next follow-up timestamp for any row; those values
remain `null`. The follow-up risk automation uses last contact, proposal
validity, customer event dates, and a scheduled return only when one is present.
No transition history is generated.

Run the seed after migrations with `npm run prisma:seed` from `backend/`. It
ensures the three sellers exist and creates each of the seven fixed commercial
codes only when absent. Existing opportunities and items are left untouched, so
rerunning the seed preserves later CRM edits and item IDs. Docker Compose runs
the same idempotent seed after `prisma migrate deploy`.

### Case requirements and implementation choices

The case explicitly defines the six stages, says Closed and Lost are final,
requires an estimated value and at least one item before entering budget
presentation, allows Lost from any non-final stage with a reason, and requires
Closing to come from Forecast. It asks for transition history and leaves
backward movements as a documented project choice. These rules are implemented
by the dedicated stage endpoint; the generic opportunity PATCH rejects `stage`.

### Pipeline and history

Active stages advance one step at a time:

| From | Allowed destination | Rule |
| --- | --- | --- |
| `PRIMEIRO_CONTATO` | `APRESENTACAO_ORCAMENTO` | Requires a non-null estimated value and at least one persisted item with positive quantity. |
| `APRESENTACAO_ORCAMENTO` | `FOLLOW_UP` | Sequential advance. |
| `FOLLOW_UP` | `FORECAST` | Sequential advance. |
| `FORECAST` | `FECHAMENTO` | Closing is only allowed from Forecast. |
| Any active stage | `PERDIDA` | Requires a non-empty loss reason after trimming; saved on the opportunity and transition. |
| Any active stage after the first | Previous active stage | One-step backward movement requires a non-empty reason, saved in transition history. |

`FECHAMENTO` and `PERDIDA` are terminal. No same-stage movement or stage jump
is accepted. These backward rules are the project's complementary choice: the
PDF gives Follow-up to Budget Presentation as an example of a possible return,
but does not prescribe exact return rules. This implementation permits only a
single active stage at a time and requires a justification.

Example request:

```http
PATCH /api/opportunities/00000000-0000-4000-8000-000000000001/stage
Content-Type: application/json
```

```json
{
  "toStage": "FOLLOW_UP",
  "version": 2,
  "reason": "Cliente solicitou nova avaliação"
}
```

The successful response is the updated opportunity, including its incremented
`version`. An outdated version returns HTTP 409. Invalid business movements or
missing commercial prerequisites return HTTP 422; malformed DTOs return 400;
missing or soft-deleted opportunities return 404. The standardized error body
includes `statusCode`, `error`, `message`, `correlationId`, `timestamp`, and
`path`.

Examples of the standard error response messages:

| Status | Example `message` | Example cause |
| --- | --- | --- |
| 400 | `Validation failed` | Unknown `stage` sent to the generic PATCH, or invalid/missing `version`. |
| 404 | `Opportunity not found` | ID does not exist or the opportunity is soft-deleted. |
| 409 | `Opportunity version is stale` | Another update already used the submitted version. |
| 422 | `An estimated value is required` | Entering budget presentation with a persisted null value. |
| 422 | `A loss reason is required` | Moving to Lost without a non-blank reason. |

The API reads the current persisted stage and item/value data before applying
the policy. A compare-and-set update conditioned on the supplied `version`
prevents concurrent requests from both succeeding. The opportunity update and
append-only `StageTransition` insert share one PostgreSQL transaction, so an
error in either operation rolls back both. The history endpoint orders by
`changedAt`, then UUID, for stable results when timestamps tie. It returns 404
for logically deleted opportunities. No edit or delete endpoint exists for
history.

Editing commercial fields does not require legacy opportunities to satisfy
current transition requirements. For an opportunity past the initial stage
that currently has both budget value and a positive item, a regular edit cannot
remove the value or all positive items. If an imported record is already
incomplete, unrelated edits remain available; a new transition into Budget
Presentation still checks the persisted values and items.

The seed continues to import the seven case opportunities as-is and creates no
transition rows: their current stages are known, but the source does not tell us
the earlier movements. OPP-2007 therefore remains `PERDIDA` with its source
loss reason absent; it is not retroactively assigned a reason or history.

Technical choices in this branch are: UUID identifiers; case-sensitive unique
seller names; server-assigned codes from a PostgreSQL sequence starting at
OPP-2008; optimistic concurrency with the required PATCH `version`; transactional
replacement of submitted items; HTTP 409 for stale versions and duplicate
codes; HTTP 422 for an unknown seller; and logical deletion without restoration.
Null optional fields are returned as JSON `null`. The case sheet's blank values
are not inferred.

## Commercial activities

`Activity` is the append-only record of a commercial interaction with a client. `StageTransition` records only changes to the pipeline stage; registering a call or message never moves an opportunity or creates a transition. The case PDF emphasizes follow-up as a sales risk, but does not specify an interaction-history entity or HTTP contract. This activity module and its `lastContactAt` synchronization are complementary implementation choices. The `WHATSAPP` type is a manual CRM note and does not integrate with WhatsApp.

The supported types are `CALL`, `EMAIL`, `MEETING`, `WHATSAPP`, and `OTHER`. Each activity has a required non-blank description, interaction timestamp (`occurredAt`), creation timestamp, and required opportunity. Only create and list endpoints exist. Activities have no update/delete endpoint and are kept when an opportunity is soft-deleted. Foreign keys use `ON DELETE RESTRICT`.

Activity timestamps and scheduled `nextFollowUpAt` values must include `Z` or an explicit UTC offset, so the API interprets them as stable instants regardless of the host timezone.

| Method and path | Behavior |
| --- | --- |
| `POST /api/opportunities/:id/activities` | Register a completed interaction; rejects missing/deleted opportunities and future timestamps. |
| `GET /api/opportunities/:id/activities` | List activity records for an active opportunity, newest first; accepts `type`, `page`, and `limit`. |

Both collection responses include pagination metadata (`page`, `limit`, `total`, `totalPages`). Ordering is `occurredAt DESC, id ASC`, making tied timestamps stable. List responses remain scoped to the requested opportunity and never include stage transitions.

All five activity types mean a contact was actually made. The service converts `occurredAt` to its UTC calendar date before writing `Opportunity.lastContactAt`, matching the PostgreSQL `DATE` column. A transaction locks the opportunity row, verifies it is still active, creates the activity, then conditionally advances `lastContactAt` only if it is null or earlier than the contact date. If the date advances, `version` increments once so existing optimistic-concurrency clients see the opportunity change; if the date is unchanged or older, `version` is untouched. The row lock serializes activity creation against other activities and soft deletion, while the conditional update keeps the date monotonic. This preserves seed-imported contact dates and does not fabricate historical activities. Closed and Lost opportunities can receive later contacts; their stage is never changed.

Activities update `lastContactAt`; the follow-up risk automation below uses that date together with proposal validity, customer event dates, and explicitly scheduled `nextFollowUpAt` values.

## Follow-up risk automation

The selected case automation is preventing forgotten follow-ups. It directly
addresses the case's fourth operational problem: helping salespeople organize
returns when contact volume is high. Alerts are private CRM records for a future
interface; they do not send email, WhatsApp, SMS, push messages, or other
customer communications.

`@nestjs/schedule` evaluates active opportunities every 15 minutes by default.
The interval and date windows can be configured in the environment:

| Variable | Default | Meaning |
| --- | ---: | --- |
| `FOLLOW_UP_EVALUATION_INTERVAL_MS` | `900000` | Evaluation interval in milliseconds; minimum 1 second. |
| `FOLLOW_UP_STALE_CONTACT_DAYS` | `7` | A contact is stale only after more than this many UTC calendar days. |
| `FOLLOW_UP_CUSTOMER_EVENT_WINDOW_DAYS` | `7` | Include events today through this many UTC calendar days ahead. |

The pure risk policy receives an explicit evaluation instant. PostgreSQL `DATE`
fields (`lastContactAt`, `proposalValidUntil`, and `customerEventDate`) are
compared as UTC calendar dates, independent of the server timezone. The
`nextFollowUpAt` timestamp is compared as an instant and is overdue at or before
the evaluation time.

The rules are independent, so an opportunity may have several different open
alerts:

| Type | Rule |
| --- | --- |
| `FOLLOW_UP_OVERDUE` | `nextFollowUpAt` is set and at or before the evaluation instant. |
| `CONTACT_STALE` | No return is scheduled, `lastContactAt` is set, and it is more than 7 calendar days old by default. A null contact date is unknown; the system does not invent one or issue this alert. |
| `PROPOSAL_EXPIRED` | `proposalValidUntil` is set and earlier than the evaluation date. |
| `CUSTOMER_EVENT_NEAR` | `customerEventDate` is today through the next 7 calendar days; past events and null dates are ignored. |

Only `PRIMEIRO_CONTATO`, `APRESENTACAO_ORCAMENTO`, `FOLLOW_UP`, and `FORECAST`
are eligible. `FECHAMENTO`, `PERDIDA`, and soft-deleted opportunities receive
no new alerts; existing open alerts are resolved at the next evaluation. Risk
checks do not create activities, change the pipeline, or change commercial
values.

Each alert stores its type, status, reference date or instant, creation time,
and optional resolution time. Resolved rows are retained as history. A
PostgreSQL partial unique index allows at most one `OPEN` alert for an
opportunity and type while permitting later occurrences after resolution.
Evaluations reconcile open alerts: a changed reference resolves the old
occurrence and creates the new one; a condition that disappears resolves its
alert. A later recurrence can therefore create a new historical row.

Manual resolution acknowledges the current occurrence by recording
`acknowledgedAt`. Repeated resolution is idempotent. While the same type and
reference remain at risk, the scheduler keeps the acknowledged occurrence
resolved. Once the condition is absent or its reference changes, the
acknowledgement is cleared; a future recurrence can create a new alert. This
avoids a manual resolve being undone by the next scheduler run.

The PostgreSQL row lock serializes reconciliation against edits to an
individual opportunity, and the partial unique index handles duplicate-create
conflicts. The in-process guard prevents overlapping runs in one API process.
There is no scheduler-wide distributed lock or leader election: multiple API
instances may scan the same opportunities and do extra work. The database
constraint keeps open alerts unique; this setup targets a simple deployment.

### Alert endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /api/alerts` | List open alerts by default; accepts `status`, `type`, `opportunityId`, `page`, and `limit`. Set `status=RESOLVED` to inspect history. |
| `GET /api/opportunities/:opportunityId/alerts` | List all alert history for an active opportunity; `opportunityId` is the alert response's `opportunityId` (or nested `opportunity.id`), never the alert's own `id`. Supports `status`, `type`, and pagination; the path already scopes the opportunity. Soft-deleted or missing opportunities return 404. |
| `PATCH /api/alerts/:alertId/resolve` | Resolve and acknowledge an open alert; `alertId` is the alert response's `id`, never `opportunityId`. Repeated calls return its existing resolved record. |

Responses include the opportunity's `id`, code, company name, and current stage
to identify the related CRM record without returning its full commercial data.
Ordering is newest creation first, with ascending alert UUID as a deterministic
tie-breaker. Swagger documents enums, filters, pagination, and responses at
`/api/docs`.

### Case-date examples

Using the PDF's reference date, 15/10/2026, without changing the intentionally
null `nextFollowUpAt` values:

| Opportunity | Expected signals |
| --- | --- |
| OPP-2001 | None: contact was 14/10 and event is outside the window. |
| OPP-2002 | `CONTACT_STALE` (contact 06/10) and `PROPOSAL_EXPIRED` (valid through 13/10). |
| OPP-2003 | `CUSTOMER_EVENT_NEAR` (event 18/10). |
| OPP-2004 | `CONTACT_STALE` (contact 02/10) and `PROPOSAL_EXPIRED` (valid through 10/10). |
| OPP-2005 | None: contact was 15/10, proposal is valid, and event is distant. |
| OPP-2006 and OPP-2007 | None: terminal stages are ineligible. |

The other three automation choices from the case are documented here but not
implemented in this feature:

1. **Fast first contact / low SLA:** timestamp lead intake, define a response
   target, show remaining time in the CRM, and alert the team or route overdue
   unassigned leads using a configurable assignment rule.
2. **Company research:** let a salesperson request company enrichment from
   verified public business sources, show source and retrieval time, and save
   reviewed facts to the opportunity. This needs a provider and data-quality
   policy that are outside this CRM-only task.
3. **Call script information:** present a structured call checklist and save
   answers as typed fields or linked activity notes, so the next salesperson
   can find the business context without reading an entire call description.

### Testing the automation

Risk policy boundaries use fixed instants and include 15/10/2026 examples:

```bash
npm test
npm run test:e2e
```

The e2e suite requires the PostgreSQL service and the versioned migrations. The
suite also expects the case rows, including OPP-2001, so first apply migrations
and run the idempotent seed in a dedicated test database:

```bash
npm run prisma:migrate:deploy
npm run prisma:seed
npm run test:e2e
```

Do not point e2e tests at an operational database: the suite creates and removes
test rows and exercises database failures with temporary triggers. The case seed
does not create alert rows; alerts appear when the scheduler runs or when an
integration test invokes the evaluator with a fixed time.

## Technical decisions and limits

NestJS supplies the module, dependency-injection, lifecycle, and HTTP
foundations already used by the project. Prisma 7 provides the generated
type-safe client and official PostgreSQL adapter while keeping database
connection setup in `prisma.config.ts` and the Nest lifecycle. Pino is used
for structured JSON output and request-scoped HTTP logging without external log
services.

Prisma migrations remain the deployment mechanism; the Compose migration
service runs `prisma migrate deploy` and the idempotent case seed before the API.
Authentication and a frontend are not implemented in this branch. The Swagger document also
describes the existing health and starter root endpoints; test-only routes are
not registered in the production application.

Useful checks:

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run lint
npm run format:check
```
