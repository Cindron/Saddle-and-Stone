# Saddle & Stone Estate Sales — v0.7.1

Preview: https://saddleandstone.cindron.ca

The staging site remains `noindex, nofollow`.

## v0.6.1 — public design lock

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


## v0.5.5 logo restoration
The v0.5.4 optimized logo asset did not render after deployment. This build removes that asset from use.

- Added a newly encoded, browser-safe WebP directly from the client's transparent master artwork.
- New canonical asset: `assets/saddle-stone-official.webp`.
- Every page now uses this one file for logo presentation.
- Header/footer no longer use the old clipped crest implementation.
- Header/footer show the wordmark area from the exact same official artwork for a cleaner horizontal treatment.
- Homepage/contact feature areas show the full transparent logo without cropping.
- Stylesheet cache key bumped to v5.5.0.

Public design remains approximately 92%; this patch is intentionally focused on restoring branding without changing the rest of the approved visual direction.


## v0.5.6 branding fix
The v0.5.5 full-logo file was not rendering in the deployed browser, which removed both the logo and business name from the header and left the larger brand areas blank.

This build removes that failed path from the rendered site and uses:
- `assets/brand-crest-v2.png` — the transparent crest already proven to render on the live site.
- `assets/saddle-stone-wordmark-live.webp` — a transparent wordmark exported directly from the approved client logo.

The header, footer, homepage heritage panel and contact brand card now use those two transparent pieces as one lockup. No black logo background and no CSS crop of a large square image.

This is a stability fix only; the approved cottage/farmhouse visual direction is unchanged.


## v0.5.8 verified logo repair
The latest live screenshots showed the crest loading while the wordmark image itself was broken.

This build replaces that failed wordmark file with a newly verified transparent PNG cropped directly from the client's supplied master logo:
- `assets/brand-wordmark-v5.png`

The already-working transparent crest remains:
- `assets/brand-crest-v2.png`

Header, footer, homepage heritage panel and contact card all use the same verified pair. No black background and no large-image CSS cropping.


## v0.5.9 final logo-path correction
The split crest + wordmark approach was still producing broken-image placeholders on the live site.

This build removes that approach completely from the rendered HTML.

One validated transparent WebP, created directly from Faith's approved transparent master logo, is now used everywhere:
- `assets/saddle-stone-logo-final.webp`

Used in:
- Header on all five public pages
- Footer on all five public pages
- Homepage heritage/contact brand panel
- Contact page brand card

There are no separate wordmark requests and no CSS cropping. The logo is displayed as the full approved artwork with its transparent background.


## v0.6.0 logo pipeline reset
The prior logo files were present in the repository but were not valid browser-renderable image payloads, which is why the live site kept showing broken-image icons.

This build fixes the problem at the asset level:
- New verified transparent PNG: `assets/saddle-stone-logo-v10.png`
- The PNG was validated before commit as a renderable 360 × 312 transparent logo.
- All five pages use the exact same absolute asset URL with a cache-busting revision.
- Header, footer, homepage brand panel and contact brand panel now use unique v0.6.0 classes so no legacy logo CSS can interfere.
- Asset caching is disabled on the staging server until the visual build is locked.
- No split crest/wordmark implementation remains in the rendered markup.

Public design remains approximately 92%. Dynamic owner login/calendar/catalog remain the next phase after the client-facing design is locked.


## v0.6.1 public design lock — 100%
The client-facing design pass is now complete.

Final polish:
- Removed all internal build/next-phase language from public copy.
- Rewrote the Sales page so it reads like a real public-facing site even before live sale dates are published.
- Kept the verified transparent logo pipeline from v0.6.0 unchanged.
- Added accessibility polish: skip link, visible keyboard focus and active-page semantics.
- Improved mobile navigation behavior: Escape-to-close and outside-click close.
- Added reduced-motion support.
- Added lazy loading for below-the-fold content images.
- Added a restrained copyright line to all public footers.
- Updated the Sales page closing panel to a client-facing inquiry CTA.

Status:
- Public visual design: 100% — locked for client review.
- Responsive multipage shell: 100%.
- Public contact/social links: complete.
- Owner login + dynamic sales/calendar/catalog: separate feature phase, not included in this visual-design percentage.

Do not alter the v0.6.0 logo asset or its URL unless a new client-approved master is explicitly supplied.


## v0.7.0 — rustic mockup restoration
Client review confirmed that the original Saddle & Stone mockup is the visual target.

This pass deliberately moves the live site back toward that design:
- Homepage uses Faith's actual portrait again in the About preview, matching the original mockup structure.
- Homepage service section now uses four editorial cards: Estate Sale Planning, Styling & Merchandising, Sale Day Support, Antique & Vintage Curation.
- Every stock image used in the HTML and CSS has been shifted away from modern interiors toward cozy cottages, country kitchens, vintage rooms, rustic cabins and warm wood interiors.
- Hero photography is now old-country / rustic rather than contemporary.
- Light surfaces use warm parchment/ivory texture; dark surfaces use walnut, olive and antique-brass tones.
- Cards, borders, typography, image treatment and section spacing have been pushed toward a heritage editorial look rather than a modern app/site aesthetic.
- Interior page heroes now use country/rustic photography and framed text panels.
- Existing multipage structure is retained.
- The proven v0.6.0 transparent logo asset is untouched.

Design rule now locked:
**Country, cottage, farmhouse, rustic cabin, vintage and barn-inspired only. No modern interior stock photography.**

Status:
- Public structure/content: complete.
- Rustic visual restoration: major pass complete; client visual review recommended.
- Owner login/calendar/catalog: still separate functional phase after the visual direction is signed off.


## v0.7.1 — homepage portrait cleanup
Client review requested that Faith's portrait not appear twice.

- Removed Faith's portrait from the homepage.
- Faith's portrait remains on the About page only.
- Replaced the homepage portrait frame with a rustic cottage/vintage interior image so the original mockup-style composition is preserved.
- Restored the handwritten-style homepage note to "Old things. New stories."
- No other design, branding, navigation or logo changes were made.


## v0.8.0 — isolated backend foundation

Backend development has started without changing or connecting to the approved
public front end.

Safety boundary:
- Root `Dockerfile` unchanged.
- Root `docker-compose.yml` unchanged.
- Public HTML/CSS/JS unchanged.
- Existing live deployment command behaves exactly as before.
- Backend has its own `docker-compose.backend.yml` and binds to localhost only.

Implemented backend foundation:
- Portable SQLite data model for catalog items, sales, images, owner accounts,
  sessions and item inquiries.
- Secure owner authentication foundation with scrypt password hashing, opaque
  server-side sessions, HttpOnly cookies, SameSite=Strict and CSRF protection.
- Login and public-inquiry rate limits.
- Catalog item CRUD API with Available / Pending / Sold / Hidden states.
- Sale CRUD foundation.
- Image upload pipeline that validates, resizes, strips metadata and re-encodes
  uploaded photos to WebP.
- Item-specific inquiry storage for the future "Ask About This Item" experience.
- Persistent runtime data under `backend-data/`, separate from containers.
- Backup command and explicit `HANDOFF.md` migration documentation.
- No default/admin password is stored in the repository.

Current client-facing website remains exactly as approved.


### Owner portal UI foundation
The isolated backend now also contains a functional owner portal at `/owner/`
for catalog items, photos, estate sales and inquiries. It is **not exposed or
linked from the approved public website**. The production web container and
normal deployment command remain unchanged.
