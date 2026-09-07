# SA AI Assistant

Monorepo for the SA AI Assistant, with a Hono API and a TanStack React platform.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker with Docker Compose

## Setup

```sh
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

The root `.env` is local-only and must not be committed.

## Development

Run the API and platform in separate terminals:

```sh
pnpm --filter api dev
pnpm --filter platform dev
```

- API: http://localhost:8000
- Platform: http://localhost:3000
- PostgreSQL: localhost:55432

## Useful commands

```sh
pnpm --filter api db:studio
pnpm --filter api build
pnpm --filter platform build
pnpm lint
pnpm format:check
```

## Repository layout

- `apps/api` — Hono API, Prisma schema, chat and document modules
- `apps/platform` — React/TanStack Router web platform
- `docker-compose.dev.yml` — local PostgreSQL service
- `.env.example` — safe environment template
