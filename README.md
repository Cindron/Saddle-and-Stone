# Saddle & Stone Estate Sales — Homepage v0.2

Temporary client-review build for Saddle & Stone Estate Sales.

## Preview
https://saddleandstone.cindron.ca

The staging site remains intentionally `noindex, nofollow`.

## v0.2 — visual/content pass
- Reworked the homepage to more closely match the approved rustic farmhouse mock-up.
- Added Faith Sampson's supplied headshot to the About section.
- Added the supplied Saddle & Stone logo to the contact area.
- Added Faith's current business contact details:
  - Phone: 705-881-3728
  - Email: saddle.and.stone.estate@gmail.com
  - Instagram: @saddle.and.stone.estate
  - Facebook link supplied by Faith
- Added service area: Uxbridge, Peterborough, Kawartha Lakes & surrounding areas.
- Added a personalized "How It Works" section focused on farmhouse, cottage, antique and vintage pieces.
- Added a full Get in Touch section with email, phone and social links.
- Improved mobile layout to retain the approved desktop design language instead of feeling like a separate simplified site.
- Placeholder property/interior photography remains temporary.

## Deployment
Server path:

```text
/opt/saddle-stone
```

Update the live preview:

```bash
cd /opt/saddle-stone
git pull
docker compose up -d --build
```

Caddy is already routing `saddleandstone.cindron.ca` to `saddle-stone-web:80`, so a normal pull/rebuild is all that is required for future site updates.

## Next
Client review of v0.2, then replace placeholder interior photography and refine any requested wording, services or sale details.
