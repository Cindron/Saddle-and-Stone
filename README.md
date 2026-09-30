# Saddle & Stone Estate Sales — v0.5

Preview: https://saddleandstone.cindron.ca

The staging site remains `noindex, nofollow`.

## v0.5 — multipage cozy cottage / farmhouse design pass

The site is now structured as a professional multipage website rather than one long homepage.

### Public pages
- `index.html` — concise homepage / brand overview
- `about.html` — Faith's story and Saddle & Stone values
- `services.html` — detailed service offering, process and FAQs
- `sales.html` — visual framework for upcoming sales, calendar and item catalog
- `contact.html` — contact details, service area and social links

### Brand / visual direction
- Cozy cottage / farmhouse vintage aesthetic
- Warm ivory and parchment backgrounds
- Deep sage / olive, rust-copper and antique-brass accents
- Editorial serif typography
- Layered photo-card treatments and subtle paper texture
- Cleaner spacing and hierarchy for a more premium, established feel
- Mobile layouts remain intentionally designed, not simply compressed desktop layouts

### Logo repair — v0.5.1
The previous `.webp` logo assets contained PNG image data but were served with a WebP MIME type, which caused the broken logo seen in the staging screenshot. v0.5 reuses the same transparent image data under the correct:
- `assets/brand-crest-v2.png`
- `assets/brand-logo-v2.png`

Header/footer use the smaller crest. Contact areas use the full transparent logo.

### Client content retained
- Faith Sampson headshot and biography
- Phone: 705-881-3728
- Email: saddle.and.stone.estate@gmail.com
- Instagram: @saddle.and.stone.estate
- Facebook link supplied by Faith
- Service area: Uxbridge, Peterborough, Kawartha Lakes & surrounding areas

## Planned feature phase

After visual approval, add the owner-only publishing system.

Planned owner workflow:
1. Secure sign-in.
2. Create/edit an estate sale.
3. Set sale dates, time, location display rules and status.
4. Upload sale photos.
5. Add/edit/remove catalog items.
6. Mark items available / sold / hidden.
7. Choose which items are featured publicly.
8. Publish/unpublish a sale.

Public output:
- Sales calendar
- Upcoming sale cards
- Sale detail pages
- Photo galleries
- Searchable/browsable item catalog
- Item availability status

The public `sales.html` page is already designed around this future data model so the feature build should not require a visual redesign.

## Deploy

```bash
cd /opt/saddle-stone
git pull
docker compose up -d --build
```

No DNS or Caddy changes are required.

## Current project status

- Brand/site design: ~80%
- Responsive multipage shell: ~90%
- Owner login/backend: 0% (next phase)
- Dynamic sales calendar/catalog: 0% (next phase)
- Overall website toward requested final scope: ~55%
