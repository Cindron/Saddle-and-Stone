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
- Owner portal UI exists at `/owner/` but is reachable only through the isolated localhost backend until we intentionally proxy it

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


## Owner portal UI

A functional private owner portal now lives inside the isolated backend at
`/owner/`.

It supports sign-in/sign-out, catalog item creation/editing/hiding, item
statuses, pricing, categories, descriptions, condition notes, featured items,
sale assignment, multi-photo upload/removal, estate sale creation/editing and
inquiry review/status changes.

The owner UI is not linked from the public website and the backend remains bound
to `127.0.0.1:8787`. Nothing becomes public until reverse-proxy routes are
deliberately added after testing.


## Backend beta additions

- Public sale endpoints are ready for the future calendar.
- Catalog API supports search and pagination.
- Owner dashboard summary endpoint added.
- Client-owned JSON export endpoint added; it excludes passwords and sessions.
- Owner password-change endpoint added; password rotation invalidates all sessions.
- Optional generic SMTP notification sends Faith a copy of new item inquiries.
  The inquiry is saved even if mail is unavailable.
- Readiness endpoint validates the database/schema.
- Upload batches validate all MIME types before writing images.

## Automated self-test

After the backend image has been built:

```bash
docker compose -f docker-compose.backend.yml run --rm backend npm run self-test
```

The self-test uses a temporary database and verifies:
- owner creation
- login/session/CSRF
- item creation
- public catalog read
- item inquiry creation
- dashboard summary
- portable JSON export

It deletes all temporary test data when finished.


## Owner preview & settings

The isolated owner portal now includes:
- Summary counts for Available / Pending / Sold items, published sales and new inquiries.
- A private shopper-view catalog preview using the live backend data.
- Portable JSON export from the Settings tab.
- Owner password change with automatic sign-out of every active session.
- A visible ownership reminder explaining that data and uploads can move to a client-owned server.

These remain inside the localhost-only backend until the isolated stack is tested.


## Safe same-domain exposure

The backend compose now joins the existing external Docker network
`saddle-stone-net` while retaining the localhost-only port mapping for health
checks.

This allows the existing Caddy container to route only:
- `/owner`
- `/api/*`
- `/uploads/*`

to the backend.

All other paths continue to route to `saddle-stone-web:80`, so enabling the
private owner portal does not replace or rebuild the approved public front end.

See `deploy/Caddyfile.backend.example` for the exact path-routing pattern.
