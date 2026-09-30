# Saddle & Stone Estate Sales — Homepage v0.4

Temporary client-review build:
https://saddleandstone.cindron.ca

The staging site remains intentionally `noindex, nofollow`.

## v0.4 — professional rebuild

This version was rebuilt from the approved Saddle & Stone mock-up rather than iterating on the previous barn-heavy layout.

### Design direction
- Warm cream / parchment background
- Deep olive, copper/rust and antique-brass accents
- Editorial serif typography
- High-quality farmhouse / cottage imagery
- Structured spacing and clear visual hierarchy
- Subtle old-country character rather than literal barn-wall styling
- Mobile layout designed separately for a polished stacked presentation

### Brand fixes
- Added a transparent-background Saddle & Stone crest for the header and footer.
- Added a transparent-background full logo in the contact section.
- Reduced logo scale dramatically so branding supports the page instead of dominating it.
- Faith Sampson's supplied headshot remains in the About section.

### Content
- Phone: 705-881-3728
- Email: saddle.and.stone.estate@gmail.com
- Instagram: @saddle.and.stone.estate
- Facebook link supplied by Faith
- Service area: Uxbridge, Peterborough, Kawartha Lakes & surrounding areas
- Get in Touch, social buttons, services and upcoming sale placeholders are included.

### Important staging fix
The previous live screenshots showed an HTML/CSS version mismatch caused by browser caching during rapid staging updates. v0.4 adds explicit cache-busting query strings and disables HTML/CSS/JS caching in Nginx while the site is under active review.

## Deploy

```bash
cd /opt/saddle-stone
git pull
docker compose up -d --build
```

No DNS or Caddy changes are required.

## Next
Review v0.4 on mobile and desktop against the approved mock-up, then make targeted content/photo refinements instead of another visual reset.
