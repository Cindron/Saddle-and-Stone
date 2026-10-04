# Saddle & Stone — Ownership & Handoff Plan

Saddle & Stone is being built as a portable client-owned application.

## What belongs to the client

At handoff, the client can receive/control:

- Complete source repository
- Public website files
- Backend source
- SQLite database
- Uploaded catalog images
- Owner account
- Domain/DNS
- Environment/configuration template
- Deployment documentation
- Backups

There is no Cindron license server, API dependency, hidden administrator or
required Cindron account in the application.

## Domain change

The application must never depend on a Cindron staging hostname in code.

When the client purchases a domain:

1. Update DNS.
2. Configure HTTPS/reverse proxy for the new hostname.
3. Change `APP_ORIGIN` in `backend/.env`.
4. Restart the backend.

Catalog data, owner credentials and uploaded photos remain unchanged.

## VPS migration

The required runtime state is intentionally concentrated in:

```text
backend-data/
├── saddle-stone.sqlite
├── uploads/
└── backups/
```

To migrate to a client-owned VPS:

1. Clone/transfer this repository.
2. Copy `backend-data/` to the new server.
3. Create `backend/.env` from `backend/.env.example`.
4. Start public and backend services.
5. Configure the new HTTPS reverse proxy.
6. Validate login, catalog images, inquiries and backups.
7. Switch DNS only after validation.

## Decommissioning Cindron access

Once the client confirms the new server is working:

1. Transfer/revoke repository access as requested.
2. Remove Cindron SSH access from the client VPS.
3. Rotate any credentials Cindron previously had access to.
4. Confirm the client can make a backup independently.
5. Remove the old hosted copy after the agreed retention period.

The goal is a clean handoff with no technical lock-in.


## Current client domain

The current production hostname is:

```text
saddleandstoneestates.ca
```

The former Cindron staging hostname may remain only as an HTTP permanent redirect.
Runtime origin checks are configured through `APP_ORIGIN`, so future domain
changes do not require application-code changes.
