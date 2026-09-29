# Saddle & Stone Estate Sales — Homepage v0.1

Initial static homepage based on the approved rustic farmhouse concept.

## Current status
- Responsive homepage is built and runnable.
- Navigation, hero, About Faith, Services, Upcoming Sales, Gallery teaser, and footer are included.
- Current photography uses temporary third-party placeholder images and is intended to be replaced with final approved/self-hosted photography.
- Phone number and email address in the footer are placeholders.
- No backend, CMS, booking, calendar, or contact form is connected yet.

## Files
- `index.html` — homepage structure/content
- `styles.css` — all layout and responsive styling
- `script.js` — mobile navigation and active section state
- `Dockerfile` — production Nginx image
- `docker-compose.yml` — isolated Saddle & Stone container/network
- `deploy/nginx.conf` — Nginx static-site config
- `deploy/Caddyfile.snippet.example` — reverse-proxy template for the existing VPS Caddy setup

## Local preview

Open `index.html` directly, or run:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## VPS deployment

The deployment files mirror the existing Cindron VPS pattern: isolated Docker container + isolated Docker network + the existing Caddy container for public HTTPS.

Planned server path:

```text
/opt/saddle-stone
```

Initial server setup:

```bash
cd /opt
git clone https://github.com/Cindron/Saddle-and-Stone.git saddle-stone
cd /opt/saddle-stone
docker compose up -d --build
docker ps --filter name=saddle-stone-web
```

Attach the existing Caddy container to the site's network:

```bash
docker network connect saddle-stone-net tornfca-caddy-1
```

Then add the final hostname to the live Caddyfile using `deploy/Caddyfile.snippet.example` as the template.

Validate and reload Caddy:

```bash
docker exec tornfca-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec tornfca-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

Future updates:

```bash
cd /opt/saddle-stone
git pull
docker compose up -d --build
docker ps --filter name=saddle-stone-web
```

## Next planned step

Choose the preview/final public hostname, add the Caddy route and DNS record, then deploy this build to the OVH VPS. After the shell is live, replace placeholder photography/contact details and refine content from Faith's final approvals.
