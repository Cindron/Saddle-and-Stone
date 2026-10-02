export function text(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export function nullablePriceCents(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100000000) {
    throw new Error("Invalid price.");
  }
  return Math.round(n);
}

export function boolInt(value) {
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

export function oneOf(value, allowed, fallback) {
  const v = String(value ?? "");
  return allowed.includes(v) ? v : fallback;
}

export function nullableId(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1) throw new Error("Invalid id.");
  return n;
}

export function slugBase(input) {
  const s = String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return s || "item";
}

export function uniqueSlug(db, table, desired, excludeId = null) {
  const base = slugBase(desired);
  let slug = base;
  let i = 2;

  while (true) {
    const row = excludeId
      ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`).get(slug, excludeId)
      : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(slug);
    if (!row) return slug;
    slug = `${base.slice(0, 62)}-${i++}`;
  }
}

export function itemPayload(body, db, existingId = null) {
  const title = text(body.title, 140);
  if (!title) throw new Error("Title is required.");

  return {
    title,
    slug: uniqueSlug(db, "items", body.slug || title, existingId),
    description: text(body.description, 6000),
    category: text(body.category, 80),
    conditionText: text(body.condition_text ?? body.conditionText, 500),
    priceCents: nullablePriceCents(body.price_cents ?? body.priceCents),
    status: oneOf(body.status, ["available", "pending", "sold", "hidden"], "available"),
    featured: boolInt(body.featured),
    saleId: nullableId(body.sale_id ?? body.saleId)
  };
}

export function salePayload(body, db, existingId = null) {
  const title = text(body.title, 160);
  if (!title) throw new Error("Title is required.");
  return {
    title,
    slug: uniqueSlug(db, "sales", body.slug || title, existingId),
    summary: text(body.summary, 6000),
    startAt: text(body.start_at ?? body.startAt, 40) || null,
    endAt: text(body.end_at ?? body.endAt, 40) || null,
    city: text(body.city, 120),
    region: text(body.region, 120),
    addressPublic: text(body.address_public ?? body.addressPublic, 300),
    status: oneOf(body.status, ["draft", "published", "archived"], "draft")
  };
}
