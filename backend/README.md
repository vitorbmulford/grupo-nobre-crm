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
remain `null`. Future risk automation must use documented signals such as last
contact, proposal validity, and customer event dates instead of assuming a
follow-up timestamp exists. No transition history is generated.

Run the seed after migrations with `npm run prisma:seed` from `backend/`. It
ensures the three sellers exist and creates each of the seven fixed commercial
codes only when absent. Existing opportunities and items are left untouched, so
rerunning the seed preserves later CRM edits and item IDs. Docker Compose runs
the same idempotent seed after `prisma migrate deploy`.

### Case requirements and implementation choices

The case explicitly defines the six stages, says Closed and Lost are final,
requires an estimated value and at least one item before entering budget
presentation, allows Lost from any non-final stage with a reason, and requires
Closing to come from Forecast. It also asks for transition history and a choice
about backward transitions. These workflow rules and history are reserved for a
later branch: this module intentionally exposes no stage transition endpoint and
does not create undocumented history.

Technical choices in this branch are: UUID identifiers; case-sensitive unique
seller names; server-assigned codes from a PostgreSQL sequence starting at
OPP-2008; optimistic concurrency with the required PATCH `version`; transactional
replacement of submitted items; HTTP 409 for stale versions and duplicate
codes; HTTP 422 for an unknown seller; and logical deletion without restoration.
Null optional fields are returned as JSON `null`. The case sheet's blank values
are not inferred.

## Technical decisions and limits

NestJS supplies the module, dependency-injection, lifecycle, and HTTP
foundations already used by the project. Prisma 7 provides the generated
type-safe client and official PostgreSQL adapter while keeping database
connection setup in `prisma.config.ts` and the Nest lifecycle. Pino is used
for structured JSON output and request-scoped HTTP logging without external log
services.

Prisma migrations remain the deployment mechanism; the Compose migration
service runs `prisma migrate deploy` and the idempotent case seed before the API.
Authentication, state transitions, transition history, activities, automation,
and a frontend are not implemented in this branch. The Swagger document also
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
