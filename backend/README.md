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

## Technical decisions and limits

NestJS supplies the module, dependency-injection, lifecycle, and HTTP
foundations already used by the project. Prisma 7 provides the generated
type-safe client and official PostgreSQL adapter while keeping database
connection setup in `prisma.config.ts` and the Nest lifecycle. Pino is used
for structured JSON output and request-scoped HTTP logging without external log
services.

Prisma migrations remain the deployment mechanism; the Compose migration
service runs `prisma migrate deploy` before the API. No business schema,
migrations, authentication, or CRM endpoints are implemented yet. The
Swagger document currently describes the existing health endpoint and starter
root endpoint; no test-only routes are included in the production application.

Useful checks:

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run lint
npm run format:check
```
