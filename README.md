# Grupo Nobre CRM

## Backend infrastructure

Copy `.env.example` to `.env` at the repository root, then start the Docker
stack:

```bash
cp .env.example .env
docker compose up --build
```

For local Nest development with PostgreSQL in Docker, run:

```bash
docker compose up -d postgres migrate
cd backend && npm run start:dev
```

The local API listens on port 3002 while the Docker API uses port 3001.
PostgreSQL is published only on loopback port 5436 for the local process.

The Docker API is available at `http://localhost:3001`; its readiness endpoint is
`http://localhost:3001/api/health`, and Swagger UI is at
`http://localhost:3001/api/docs`. PostgreSQL is published only on
`127.0.0.1:5436` for local Nest development. Data is stored in the named
`postgres_data` volume.

The `migrate` service runs `prisma migrate deploy` once after PostgreSQL is
healthy. The backend waits for that service to complete successfully before
starting. With no migrations in the repository, Prisma reports that there are
no pending migrations and exits successfully. Add versioned migrations under
`backend/prisma/migrations` as the schema evolves; do not use `prisma migrate dev`
or `prisma db push` in the startup flow.

`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and
`POSTGRES_PASSWORD` configure PostgreSQL and are used to construct the
backend's `DATABASE_URL`. `PORT` is the backend's listening port and
`BACKEND_HOST_PORT` is the loopback host port published to the developer
machine. `NODE_ENV` selects the runtime environment. `LOG_LEVEL` controls Pino,
and `CORS_ORIGINS` is a comma-separated allowlist of exact HTTP(S) origins
(defaulting to `http://localhost:3000`). The API returns `X-Correlation-ID` for
every request and uses a standardized error body; see
[`backend/README.md`](backend/README.md) for the HTTP, security, and logging
behavior. Use URL-encoded characters in database credentials if they contain reserved URL characters such as `@`,
`:`, `/`, or `#`.

The Compose network `app_internal` isolates PostgreSQL and the migration job.
The backend also joins `app_ingress` so its published HTTP port is reachable
from the host. A future frontend can join the appropriate network without
publishing PostgreSQL.
