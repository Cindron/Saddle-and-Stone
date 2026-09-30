# Saddle & Stone Estate Sales — v0.5.4

Preview: https://saddleandstone.cindron.ca

The staging site remains `noindex, nofollow`.

## v0.5.4 — official transparent logo integration

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

## v0.5.2 refinement notes
- Removed Faith's portrait from the homepage; her photo now appears only on the About page.
- Replaced the homepage portrait area with a layered vintage farmhouse still-life.
- Replaced the blank green contact panel with a photographed cottage/farmhouse panel and inset heritage card.
- Replaced large full-logo image dependencies with a reliable composite mark built from the working crest plus live typography.
- Added more brown/leather/walnut tones throughout the site.
- Added subtle paper/fabric-like texture to light backgrounds and gentle wood-grain-style striping to dark areas.
- Kept textures restrained so the site still feels premium rather than themed.

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


## v0.5.3 logo correction
The visual issue reported in review was confirmed: the standalone optimized crest file had actually been cropped through the lower stone curve. This was not just a CSS sizing problem.

Fix:
- Stop using the cropped standalone crest as the displayed source.
- Use the original complete `saddle-stone-logo.webp` artwork everywhere.
- Header/footer compact marks now crop the emblem presentation from the complete source with CSS, preserving the whole lower curve.
- Larger brand areas now display the complete logo, including the lower rule and `ESTATE SALES` wording.
- Added extra overflow protection and a new stylesheet cache key.

No backend/catalog work was started in this patch; design remains the priority until public visual approval.


## v0.5.4 official logo integration
- The client supplied the intended transparent Saddle & Stone logo source.
- Verified the source contains a true alpha channel.
- Created one web-optimized master asset from that exact artwork with transparent breathing room: `assets/saddle-stone-brand.webp`.
- No logo redesign, redraw or alternate branding was introduced.
- Every logo image reference across Home, About, Services, Sales and Contact now points to the same master asset.
- Header/footer use the same artwork as a compact emblem treatment.
- Large logo areas use the complete transparent mark.
- Replaced dark/black-looking logo presentation fields with warm parchment treatments so the transparent artwork reads naturally against the farmhouse palette.
- Refined the contact feature card so the logo is no longer visually fighting a dark panel.

### Current status
- Public visual design: ~92%
- Responsive multipage shell: ~92%
- Owner login/backend: 0% (next phase after visual lock)
- Dynamic sales calendar/catalog: 0% (next phase)
- Overall website toward final requested scope: ~57%
