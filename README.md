# Grupo Nobre CRM

## Backend infrastructure

Copy `.env.example` to `.env` at the repository root, then start the Docker
stack:

```bash
cp .env.example .env
docker compose up --build
```

The application is available through Nginx at `http://localhost`. Nginx routes
`/api/*` to Nest and all other paths (including `/_next/*`) to Next.js. The API
health endpoint and Swagger UI are `http://localhost/api/health` and
`http://localhost/api/docs`. Only Nginx publishes a host port; PostgreSQL,
backend, and frontend remain on Docker networks. PostgreSQL is attached only to
the internal network and is not reachable from the host.

For local Nest development outside Docker, use a PostgreSQL instance available
to the host and configure `DATABASE_URL` accordingly, then run:

```bash
cd backend && npm run start:dev
```

The local API listens on port 3002. Data used by the Docker stack is stored in
the existing named `postgres_data` volume.

### Ambientes de execução

O navegador sempre chama a API por `/api`. Cada cenário tem somente um proxy
ativo para esse caminho: Nginx nos cenários com Docker e o rewrite do Next no
desenvolvimento totalmente local.

#### Frontend local + backend e Nginx no Docker

Use este cenário para hot reload no Next.js mantendo a API e o banco no
Compose. Pare o frontend/Nginx padrão e inicie o Nginx voltado ao host:

```bash
docker compose stop frontend nginx
docker compose -f compose.yaml -f compose.local.yaml up -d postgres migrate backend nginx-local
```

Em outro terminal, prepare as variáveis locais do frontend uma única vez e
inicie o Next.js:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost`. O Nginx local encaminha `/api/*` ao backend Docker e
as demais rotas ao Next em `localhost:3000`. O rewrite do Next não recebe
essas chamadas. Para retornar ao frontend containerizado, pare `nginx-local`
com os mesmos arquivos Compose e execute `docker compose up -d --build`.

#### Aplicação completa no Docker

Na raiz, copie `.env.example` para `.env` se ainda não existir e execute:

```bash
docker compose up --build
```

Abra `http://localhost`. Nginx é o único proxy de `/api`; a imagem do frontend
é sempre construída com `/api` e não lê `frontend/.env.local`.

#### Frontend e backend locais, sem Nginx

Configure um PostgreSQL acessível pela `DATABASE_URL` do `.env` da raiz e
inicie o Nest localmente:

```bash
cd backend
npm ci
npm run start:dev
```

Em outro terminal, execute:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost:3000`. Em desenvolvimento, o Next encaminha
`/api/*` para `NEXT_LOCAL_API_ORIGIN` (por padrão,
`http://localhost:3002`). Altere somente essa variável em `.env.local` se o
Nest usar outra porta.

The `migrate` service runs `prisma migrate deploy` and then the idempotent case
seed after PostgreSQL is healthy. The backend waits for that service to complete
successfully before starting. Add versioned migrations under
`backend/prisma/migrations`; do not use `prisma migrate dev` or `prisma db push`
in the startup flow.

`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and
`POSTGRES_PASSWORD` configure PostgreSQL and are used to construct the
backend's `DATABASE_URL`. `PORT` is the backend's listening port. `HTTP_HOST_PORT`
sets the Nginx host port (default `80`). O frontend usa sempre o caminho
relativo `/api`; `NEXT_LOCAL_API_ORIGIN` existe apenas em `frontend/.env.local`
para o rewrite do Next em desenvolvimento. `NODE_ENV` selects the runtime
environment. `LOG_LEVEL` controls Pino, and `CORS_ORIGINS` is a comma-separated
allowlist of exact HTTP(S) origins (defaulting to `http://localhost` and
`http://localhost:3000` for direct local development). The API returns
`X-Correlation-ID` for every request and uses a standardized error body; see
[`backend/README.md`](backend/README.md) for the HTTP, security, and logging
behavior. Use URL-encoded characters in database credentials if they contain reserved URL characters such as `@`,
`:`, `/`, or `#`.

The Compose network `app_internal` isolates PostgreSQL and the migration job.
Nginx, backend, and frontend communicate over `app_ingress`; only Nginx is
published to the host. The browser uses the same origin for the frontend and API.

## Frontend

The CRM frontend uses Next.js and is included in the Compose stack. Start the
full application with `docker compose up --build`; open `http://localhost`.
For local Next.js development, copy
[`frontend/.env.example`](frontend/.env.example) to `frontend/.env.local`, then
run `npm ci` and `npm run dev` in `frontend/`. See
[`frontend/README.md`](frontend/README.md) for the architecture, scripts, data
behavior, and current scope.

## Opportunities and deletion policy

The first CRM module provides opportunities, their gift items, and salespeople.
Its endpoints and business rules are documented in
[`backend/README.md`](backend/README.md). Deleting an opportunity is a logical
delete: the API sets `deletedAt`, keeps its commercial code and items, and hides
it from regular queries. There is no restore endpoint. The case PDF is a local
input and is ignored by Git.
Stage changes use a dedicated pipeline endpoint with optimistic concurrency and
append-only transition history; the backend README documents its rules and
examples.

The backend evaluates follow-up risks at startup and every 15 minutes and stores
deduplicated, resolvable alerts in PostgreSQL. The risk types, configuration,
manual acknowledgment behavior, API, case-date scenarios, and test commands are
documented in [`backend/README.md`](backend/README.md#follow-up-risk-automation).
