# Saddle & Stone Backend — isolated feature phase

This backend is intentionally **not connected to the public website yet**.

The approved public site continues to be built and served by the root `Dockerfile`
and root `docker-compose.yml`. Normal production deployment remains:

```bash
docker compose up -d --build
```

That command does not build, start, proxy or expose this backend.

## Architecture

- Node 22 / Express
- SQLite database stored outside the container
- Uploaded images stored outside the container
- Passwords hashed with Node `scrypt`
- Opaque random sessions stored in SQLite
- HttpOnly / SameSite=Strict session cookie
- Per-session CSRF token required on owner writes
- Login and inquiry rate limits
- Uploaded images are decoded and re-encoded to WebP with Sharp
  - arbitrary uploaded files are not served
  - image metadata is stripped
  - maximum dimensions are reduced to 2200px
- Public catalog/inquiry API exists but is not wired into the visible site
- Owner API exists but no owner UI is exposed yet

## Data locations

Inside the container:

```text
/data/saddle-stone.sqlite
/data/uploads/
/data/backups/
```

In the current optional test compose these map to:

```text
./backend-data/
```

That folder is gitignored and is the important client-owned runtime data.

## Optional isolated backend test

Do **not** run this just to deploy the public site.

When ready to test the backend:

```bash
cp backend/.env.example backend/.env
# For direct localhost HTTP testing only, set COOKIE_SECURE=false
docker compose -f docker-compose.backend.yml up -d --build
```

The backend binds only to:

```text
127.0.0.1:8787
```

It is therefore not publicly reachable from the internet.

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Create Faith's owner account

Run interactively so the password is not placed in shell history:

```bash
docker compose -f docker-compose.backend.yml run --rm backend npm run create-admin
```

No default password exists and no credentials are committed.

## Current API foundation

Public, but currently localhost-only:
- `GET /health`
- `GET /api/catalog`
- `GET /api/catalog/:slug`
- `POST /api/catalog/:slug/inquiries`

Owner:
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET/POST /api/admin/items`
- `PUT/DELETE /api/admin/items/:id`
- `POST /api/admin/items/:id/images`
- `DELETE /api/admin/items/:itemId/images/:imageId`
- `GET/POST /api/admin/sales`
- `PUT /api/admin/sales/:id`
- `GET /api/admin/inquiries`
- `PATCH /api/admin/inquiries/:id`

## Backup

With the backend container running:

```bash
docker compose -f docker-compose.backend.yml exec backend npm run backup
```

A consistent SQLite snapshot plus all uploads is written under
`backend-data/backups/`. Secrets are intentionally excluded.

## Migration / handoff

The backend does not depend on Cindron, the current preview domain or the
current VPS. A future handoff consists of:

1. Copy/transfer the repository.
2. Copy `backend-data/`.
3. Create `backend/.env` from the example with the new domain.
4. Start the containers.
5. Configure HTTPS/reverse proxy on the new server.
6. Point the client's DNS at the new server.

No catalog records or uploaded images need to be recreated.
