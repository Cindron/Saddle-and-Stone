# Saddle & Stone Estate Sales — Homepage v0.1

Initial static homepage based on the approved rustic farmhouse concept.

## Preview hostname

The temporary client-preview hostname is:

```text
https://saddleandstone.cindron.ca
```

This staging build is intentionally marked `noindex, nofollow` and includes a restrictive `robots.txt` so search engines should not index it while the client reviews the site.

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
- `robots.txt` — blocks staging-site crawling
- `Dockerfile` — production Nginx image
- `docker-compose.yml` — isolated Saddle & Stone container/network
- `deploy/nginx.conf` — Nginx static-site config
- `deploy/Caddyfile.snippet.example` — Caddy route for the temporary preview hostname

## Local preview

Open `index.html` directly, or run:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## VPS deployment

The deployment files mirror the existing Cindron VPS pattern: isolated Docker container + isolated Docker network + the existing Caddy container for public HTTPS.

Server path:

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

Add this block to the live Caddyfile:

```caddy
saddleandstone.cindron.ca {
    reverse_proxy saddle-stone-web:80
}
```

Validate and reload Caddy:

```bash
docker exec tornfca-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec tornfca-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

### DNS

Create a DNS record for `saddleandstone.cindron.ca` pointing to the same public VPS IP already serving the other Cindron-hosted sites. Once DNS resolves, Caddy can obtain HTTPS automatically.

## Future updates

```bash
cd /opt/saddle-stone
git pull
docker compose up -d --build
docker ps --filter name=saddle-stone-web
```

## Next planned step

Bring the temporary preview hostname online, have Faith review the actual responsive website, then replace placeholder photos/contact details and make the next design/content revisions before the final domain is purchased.
