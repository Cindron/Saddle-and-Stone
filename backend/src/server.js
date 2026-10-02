import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { config } from "./config.js";
import { db, cleanupExpiredSessions } from "./db.js";
import {
  normalizeEmail,
  verifyPassword,
  createSession,
  clearSession,
  authRequired,
  csrfRequired,
  originGuard
} from "./security.js";
import {
  text,
  itemPayload,
  salePayload,
  oneOf
} from "./validators.js";

const app = express();
if (config.trustProxy) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "1mb" }));
app.use(originGuard);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." }
});

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many inquiries from this connection. Please try again later." }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadMb * 1024 * 1024,
    files: config.maxImagesPerItem
  }
});

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function publicImage(row) {
  return row ? {
    id: row.id,
    url: `/uploads/${encodeURIComponent(row.filename)}`,
    alt_text: row.alt_text,
    sort_order: row.sort_order
  } : null;
}

function imagesForItem(itemId) {
  return db.prepare(`
    SELECT id, filename, alt_text, sort_order
    FROM item_images
    WHERE item_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(itemId).map(publicImage);
}

function itemView(row) {
  if (!row) return null;
  return {
    id: row.id,
    item_code: row.item_code,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    condition_text: row.condition_text,
    price_cents: row.price_cents,
    status: row.status,
    featured: Boolean(row.featured),
    sale_id: row.sale_id,
    sale_title: row.sale_title ?? null,
    sale_slug: row.sale_slug ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images: imagesForItem(row.id)
  };
}

function getItemById(id) {
  const row = db.prepare(`
    SELECT i.*, s.title AS sale_title, s.slug AS sale_slug
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE i.id = ?
  `).get(id);
  return itemView(row);
}

function validateSaleExists(saleId) {
  if (saleId == null) return;
  const sale = db.prepare("SELECT id FROM sales WHERE id = ?").get(saleId);
  if (!sale) throw new Error("Selected sale does not exist.");
}

function requirePositiveId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error("Invalid id.");
    err.status = 400;
    throw err;
  }
  return id;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "saddle-stone-backend" });
});

// Uploaded catalog photos are public only when the backend is eventually
// reverse-proxied. Current compose binds the service to 127.0.0.1 only.
app.use("/uploads", express.static(config.uploadDir, {
  fallthrough: false,
  immutable: true,
  maxAge: "30d",
  dotfiles: "deny",
  index: false
}));

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  const admin = db.prepare(`
    SELECT id, email, password_salt, password_hash
    FROM admins
    WHERE email = ?
  `).get(email);

  if (!admin || !verifyPassword(password, admin.password_salt, admin.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const session = createSession(admin.id, res);
  res.json({
    ok: true,
    admin: { id: admin.id, email: admin.email },
    csrf_token: session.csrfToken,
    expires_at: session.expiresAt
  });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({
    admin: { id: req.auth.admin_id, email: req.auth.email },
    csrf_token: req.auth.csrf_token,
    expires_at: req.auth.expires_at
  });
});

app.post("/api/auth/logout", authRequired, csrfRequired, (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

// PUBLIC CATALOG API — not wired into the approved front-end yet.
app.get("/api/catalog", (req, res) => {
  const status = oneOf(req.query.status, ["available", "pending", "sold"], "");
  const featured = req.query.featured === "1" || req.query.featured === "true";
  const category = text(req.query.category, 80);

  const where = ["i.status <> 'hidden'", "(i.sale_id IS NULL OR s.status = 'published')"];
  const args = [];
  if (status) {
    where.push("i.status = ?");
    args.push(status);
  }
  if (featured) where.push("i.featured = 1");
  if (category) {
    where.push("i.category = ?");
    args.push(category);
  }

  const rows = db.prepare(`
    SELECT i.*, s.title AS sale_title, s.slug AS sale_slug
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE ${where.join(" AND ")}
    ORDER BY i.featured DESC, i.created_at DESC
    LIMIT 250
  `).all(...args);

  res.json({ items: rows.map(itemView) });
});

app.get("/api/catalog/:slug", (req, res) => {
  const row = db.prepare(`
    SELECT i.*, s.title AS sale_title, s.slug AS sale_slug
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE i.slug = ?
      AND i.status <> 'hidden'
      AND (i.sale_id IS NULL OR s.status = 'published')
  `).get(req.params.slug);

  if (!row) return res.status(404).json({ error: "Item not found." });
  res.json({ item: itemView(row) });
});

app.post("/api/catalog/:slug/inquiries", inquiryLimiter, (req, res) => {
  // Honeypot field. Real visitors never fill this.
  if (text(req.body?.website, 200)) return res.json({ ok: true });

  const row = db.prepare(`
    SELECT i.id, i.title, i.item_code
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE i.slug = ?
      AND i.status <> 'hidden'
      AND (i.sale_id IS NULL OR s.status = 'published')
  `).get(req.params.slug);

  if (!row) return res.status(404).json({ error: "Item not found." });

  const name = text(req.body?.name, 120);
  const email = text(req.body?.email, 200);
  const phone = text(req.body?.phone, 80);
  const message = text(req.body?.message, 3000);

  if (!name) return res.status(400).json({ error: "Name is required." });
  if (!email && !phone) {
    return res.status(400).json({ error: "Email or phone is required." });
  }

  db.prepare(`
    INSERT INTO inquiries(item_id, name, email, phone, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(row.id, name, email, phone, message);

  res.status(201).json({
    ok: true,
    item: { item_code: row.item_code, title: row.title }
  });
});

// Everything below here is owner-only.
app.use("/api/admin", authRequired);

app.get("/api/admin/items", (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, s.title AS sale_title, s.slug AS sale_slug
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    ORDER BY i.created_at DESC
  `).all();
  res.json({ items: rows.map(itemView) });
});

app.post("/api/admin/items", csrfRequired, (req, res) => {
  try {
    const p = itemPayload(req.body || {}, db);
    validateSaleExists(p.saleId);

    db.exec("BEGIN IMMEDIATE");
    try {
      const result = db.prepare(`
        INSERT INTO items(
          slug, title, description, category, condition_text,
          price_cents, status, featured, sale_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        p.slug, p.title, p.description, p.category, p.conditionText,
        p.priceCents, p.status, p.featured, p.saleId
      );

      const id = Number(result.lastInsertRowid);
      const code = `SAS-${String(id).padStart(4, "0")}`;
      db.prepare("UPDATE items SET item_code = ? WHERE id = ?").run(code, id);
      db.exec("COMMIT");

      res.status(201).json({ item: getItemById(id) });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/admin/items/:id", csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    if (!db.prepare("SELECT id FROM items WHERE id = ?").get(id)) {
      return res.status(404).json({ error: "Item not found." });
    }

    const p = itemPayload(req.body || {}, db, id);
    validateSaleExists(p.saleId);

    db.prepare(`
      UPDATE items SET
        slug = ?, title = ?, description = ?, category = ?,
        condition_text = ?, price_cents = ?, status = ?,
        featured = ?, sale_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      p.slug, p.title, p.description, p.category,
      p.conditionText, p.priceCents, p.status,
      p.featured, p.saleId, id
    );

    res.json({ item: getItemById(id) });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.delete("/api/admin/items/:id", csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const row = db.prepare("SELECT id FROM items WHERE id = ?").get(id);
    if (!row) return res.status(404).json({ error: "Item not found." });

    // Non-destructive delete: preserve history and inquiries.
    db.prepare(`
      UPDATE items
      SET status = 'hidden', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({ ok: true, item: getItemById(id) });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.post(
  "/api/admin/items/:id/images",
  csrfRequired,
  upload.array("images", config.maxImagesPerItem),
  asyncRoute(async (req, res) => {
    const itemId = requirePositiveId(req.params.id);
    const item = db.prepare("SELECT id, title FROM items WHERE id = ?").get(itemId);
    if (!item) return res.status(404).json({ error: "Item not found." });

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ error: "No images supplied." });

    const currentCount = Number(db.prepare(
      "SELECT COUNT(*) AS count FROM item_images WHERE item_id = ?"
    ).get(itemId).count);

    if (currentCount + files.length > config.maxImagesPerItem) {
      return res.status(400).json({
        error: `Maximum ${config.maxImagesPerItem} images per item.`
      });
    }

    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const created = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowed.has(file.mimetype)) {
        return res.status(415).json({ error: "Only JPEG, PNG and WebP images are accepted." });
      }

      // Decode + re-encode every upload. This validates that it is really an
      // image, strips embedded metadata and prevents arbitrary file uploads.
      const filename = `${crypto.randomUUID()}.webp`;
      const target = path.join(config.uploadDir, filename);

      await sharp(file.buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({
          width: 2200,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: 84 })
        .toFile(target);

      const order = currentCount + i;
      const result = db.prepare(`
        INSERT INTO item_images(item_id, filename, alt_text, sort_order)
        VALUES (?, ?, ?, ?)
      `).run(itemId, filename, item.title, order);

      created.push({
        id: Number(result.lastInsertRowid),
        filename,
        url: `/uploads/${encodeURIComponent(filename)}`,
        alt_text: item.title,
        sort_order: order
      });
    }

    db.prepare("UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(itemId);
    res.status(201).json({ images: created, item: getItemById(itemId) });
  })
);

app.delete("/api/admin/items/:itemId/images/:imageId", csrfRequired, (req, res) => {
  try {
    const itemId = requirePositiveId(req.params.itemId);
    const imageId = requirePositiveId(req.params.imageId);

    const image = db.prepare(`
      SELECT id, filename FROM item_images
      WHERE id = ? AND item_id = ?
    `).get(imageId, itemId);

    if (!image) return res.status(404).json({ error: "Image not found." });

    db.prepare("DELETE FROM item_images WHERE id = ?").run(imageId);
    const filePath = path.join(config.uploadDir, image.filename);
    try { fs.unlinkSync(filePath); } catch {}

    db.prepare("UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(itemId);
    res.json({ ok: true, item: getItemById(itemId) });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/api/admin/sales", (_req, res) => {
  const sales = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM items i WHERE i.sale_id = s.id) AS item_count
    FROM sales s
    ORDER BY COALESCE(s.start_at, s.created_at) DESC
  `).all();
  res.json({ sales });
});

app.post("/api/admin/sales", csrfRequired, (req, res) => {
  try {
    const p = salePayload(req.body || {}, db);
    const result = db.prepare(`
      INSERT INTO sales(
        title, slug, summary, start_at, end_at, city, region,
        address_public, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      p.title, p.slug, p.summary, p.startAt, p.endAt, p.city,
      p.region, p.addressPublic, p.status
    );
    const id = Number(result.lastInsertRowid);
    res.status(201).json({
      sale: db.prepare("SELECT * FROM sales WHERE id = ?").get(id)
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put("/api/admin/sales/:id", csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    if (!db.prepare("SELECT id FROM sales WHERE id = ?").get(id)) {
      return res.status(404).json({ error: "Sale not found." });
    }

    const p = salePayload(req.body || {}, db, id);
    db.prepare(`
      UPDATE sales SET
        title = ?, slug = ?, summary = ?, start_at = ?, end_at = ?,
        city = ?, region = ?, address_public = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      p.title, p.slug, p.summary, p.startAt, p.endAt,
      p.city, p.region, p.addressPublic, p.status, id
    );

    res.json({ sale: db.prepare("SELECT * FROM sales WHERE id = ?").get(id) });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/api/admin/inquiries", (_req, res) => {
  const inquiries = db.prepare(`
    SELECT q.*, i.item_code, i.title AS item_title, i.slug AS item_slug
    FROM inquiries q
    JOIN items i ON i.id = q.item_id
    ORDER BY
      CASE q.status WHEN 'new' THEN 0 WHEN 'read' THEN 1 ELSE 2 END,
      q.created_at DESC
    LIMIT 500
  `).all();
  res.json({ inquiries });
});

app.patch("/api/admin/inquiries/:id", csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const status = oneOf(req.body?.status, ["new", "read", "closed"], "");
    if (!status) return res.status(400).json({ error: "Invalid inquiry status." });

    const result = db.prepare("UPDATE inquiries SET status = ? WHERE id = ?").run(status, id);
    if (!result.changes) return res.status(404).json({ error: "Inquiry not found." });

    res.json({
      inquiry: db.prepare("SELECT * FROM inquiries WHERE id = ?").get(id)
    });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: "Server error." });
});

cleanupExpiredSessions();
const sessionTimer = setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
sessionTimer.unref();

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`Saddle & Stone backend listening on port ${config.port}`);
});

function shutdown() {
  server.close(() => {
    try { db.close(); } catch {}
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
