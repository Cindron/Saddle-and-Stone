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
  originGuard,
  rotateAdminPassword,
  ownerRequired,
  hashPassword
} from "./security.js";
import {
  text,
  itemPayload,
  salePayload,
  oneOf
} from "./validators.js";
import { sendInquiryNotification } from "./mailer.js";

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

app.get("/ready", (_req, res) => {
  try {
    const row = db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get();
    db.prepare("SELECT 1 AS ok").get();
    res.json({ ok: true, schema_version: row?.value || "unknown" });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.get("/sitemap.xml", (_req, res) => {
  const base = (config.appOrigin || "https://saddleandstoneestates.ca").replace(/\/+$/, "");
  const staticUrls = [
    base + "/",
    base + "/about.html",
    base + "/services.html",
    base + "/sales.html",
    base + "/contact.html",
    base + "/catalog/",
    base + "/calendar/"
  ];

  const itemUrls = db.prepare(`
    SELECT slug, updated_at
    FROM items
    WHERE status <> 'hidden'
    ORDER BY updated_at DESC
  `).all();

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls.map(url => '  <url><loc>' + url + '</loc></url>'),
    ...itemUrls.map(row => {
      const loc = base + "/catalog/?item=" + encodeURIComponent(row.slug);
      const lastmod = row.updated_at
        ? '<lastmod>' + String(row.updated_at).replace(" ", "T") + 'Z</lastmod>'
        : '';
      return '  <url><loc>' + loc + '</loc>' + lastmod + '</url>';
    }),
    '</urlset>'
  ].join("\n");

  res.type("application/xml");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(xml);
});

// Private owner portal UI. The API remains the security boundary; this static
// shell contains no credentials and exposes no data unless authentication succeeds.
app.use("/owner", express.static(path.join(process.cwd(), "admin"), {
  index: "index.html",
  fallthrough: true,
  etag: false,
  maxAge: 0,
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
}));

// Public customer catalog shell.
app.use("/catalog", express.static(path.join(process.cwd(), "catalog"), {
  index: "index.html",
  fallthrough: true,
  etag: true,
  maxAge: "5m",
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=300");
  }
}));

app.use("/calendar", express.static(path.join(process.cwd(), "calendar"), {
  index: "index.html",
  fallthrough: true,
  etag: true,
  maxAge: "5m",
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("Cache-Control", "public, max-age=300");
  }
}));

// Uploaded catalog photos are public only when the backend is eventually
// reverse-proxied. Current compose binds the service to 127.0.0.1 only.
app.use("/uploads", express.static(config.uploadDir, {
  fallthrough: false,
  immutable: true,
  maxAge: "30d",
  dotfiles: "deny",
  index: false
}));

app.use("/api", (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  const admin = db.prepare(`
    SELECT id, email, password_salt, password_hash, display_name, role
    FROM admins
    WHERE email = ?
  `).get(email);

  if (!admin || !verifyPassword(password, admin.password_salt, admin.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const session = createSession(admin.id, res);
  res.json({
    ok: true,
    admin: { id: admin.id, email: admin.email, display_name: admin.display_name || "", role: admin.role || "admin" },
    csrf_token: session.csrfToken,
    expires_at: session.expiresAt
  });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({
    admin: { id: req.auth.admin_id, email: req.auth.email, display_name: req.auth.display_name || "", role: req.auth.role || "admin" },
    csrf_token: req.auth.csrf_token,
    expires_at: req.auth.expires_at
  });
});

app.post("/api/auth/logout", authRequired, csrfRequired, (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

// PUBLIC DATA API — not wired into the approved front-end yet.
app.get("/api/sales", (_req, res) => {
  const sales = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM items i
       WHERE i.sale_id = s.id AND i.status <> 'hidden') AS item_count
    FROM sales s
    WHERE s.status = 'published'
    ORDER BY COALESCE(s.start_at, s.created_at) ASC
  `).all();

  res.json({ sales });
});

app.get("/api/sales/:slug", (req, res) => {
  const sale = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM items i
       WHERE i.sale_id = s.id AND i.status <> 'hidden') AS item_count
    FROM sales s
    WHERE s.slug = ? AND s.status = 'published'
  `).get(req.params.slug);

  if (!sale) return res.status(404).json({ error: "Sale not found." });

  const items = db.prepare(`
    SELECT i.*, s.title AS sale_title, s.slug AS sale_slug
    FROM items i
    JOIN sales s ON s.id = i.sale_id
    WHERE i.sale_id = ? AND i.status <> 'hidden'
    ORDER BY i.featured DESC, i.created_at DESC
  `).all(sale.id);

  res.json({ sale, items: items.map(itemView) });
});

app.get("/api/catalog", (req, res) => {
  const status = oneOf(req.query.status, ["available", "pending", "sold"], "");
  const featured = req.query.featured === "1" || req.query.featured === "true";
  const category = text(req.query.category, 80);
  const query = text(req.query.q, 120);
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit || "48", 10) || 48));
  const offset = Math.max(0, Number.parseInt(req.query.offset || "0", 10) || 0);

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
  if (query) {
    where.push("(i.title LIKE ? OR i.description LIKE ? OR i.category LIKE ? OR i.item_code LIKE ?)");
    const q = `%${query}%`;
    args.push(q, q, q, q);
  }

  const count = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE ${where.join(" AND ")}
  `).get(...args).count);

  const rows = db.prepare(`
    SELECT i.*, s.title AS sale_title, s.slug AS sale_slug
    FROM items i
    LEFT JOIN sales s ON s.id = i.sale_id
    WHERE ${where.join(" AND ")}
    ORDER BY i.featured DESC, i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...args, limit, offset);

  res.json({ items: rows.map(itemView), total: count, limit, offset });
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

app.post("/api/catalog/:slug/inquiries", inquiryLimiter, asyncRoute(async (req, res) => {
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

  const result = db.prepare(`
    INSERT INTO inquiries(item_id, name, email, phone, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(row.id, name, email, phone, message);

  const inquiry = {
    id: Number(result.lastInsertRowid),
    name, email, phone, message
  };

  // Email is best-effort. The database record remains the source of truth.
  const notification = await sendInquiryNotification({ item: row, inquiry });

  res.status(201).json({
    ok: true,
    item: { item_code: row.item_code, title: row.title },
    notification_sent: Boolean(notification.sent)
  });
}));

// Everything below here is owner-only.
app.use("/api/admin", authRequired);

app.get("/api/admin/site-settings", (_req, res) => {
  const rows = db.prepare("SELECT key, value, updated_at FROM site_settings ORDER BY key").all();
  res.json({
    settings: Object.fromEntries(rows.map(row => [row.key, row.value])),
    rows
  });
});

app.put("/api/admin/site-settings", csrfRequired, (req, res) => {
  const allowed = new Set(["business_name","tagline","phone","email","service_area","instagram","facebook"]);
  const entries = Object.entries(req.body || {}).filter(([key]) => allowed.has(key));
  if (!entries.length) return res.status(400).json({ error: "No valid settings supplied." });

  const upsert = db.prepare(`
    INSERT INTO site_settings(key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [key, value] of entries) {
      upsert.run(key, text(value, key === "service_area" ? 300 : 500));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const rows = db.prepare("SELECT key, value FROM site_settings ORDER BY key").all();
  res.json({ settings: Object.fromEntries(rows.map(row => [row.key, row.value])) });
});

app.get("/api/admin/system", (_req, res) => {
  let databaseBytes = 0;
  let uploadCount = 0;
  let backupCount = 0;
  try { databaseBytes = fs.statSync(config.dbPath).size; } catch {}
  try { uploadCount = fs.readdirSync(config.uploadDir).filter(name => !name.startsWith(".")).length; } catch {}
  try { backupCount = fs.readdirSync(config.backupDir).filter(name => name.startsWith("saddle-stone-")).length; } catch {}

  res.json({
    ok: true,
    schema_version: db.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get()?.value || "unknown",
    database_bytes: databaseBytes,
    upload_count: uploadCount,
    backup_count: backupCount
  });
});

app.get("/api/admin/backups", (_req, res) => {
  let backups = [];
  try {
    backups = fs.readdirSync(config.backupDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith("saddle-stone-"))
      .map(entry => {
        const full = path.join(config.backupDir, entry.name);
        let created_at = "";
        try { created_at = fs.statSync(full).mtime.toISOString(); } catch {}
        return { name: entry.name, created_at };
      })
      .sort((a,b) => b.created_at.localeCompare(a.created_at));
  } catch {}
  res.json({ backups });
});

app.post("/api/admin/backups", csrfRequired, (req, res) => {
  try {
    fs.mkdirSync(config.backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `saddle-stone-${stamp}`;
    const targetDir = path.join(config.backupDir, name);
    const targetUploads = path.join(targetDir, "uploads");
    fs.mkdirSync(targetUploads, { recursive: true });

    const targetDb = path.join(targetDir, "saddle-stone.sqlite");
    const safeDb = targetDb.replaceAll("'", "''");
    db.exec(`VACUUM INTO '${safeDb}'`);

    if (fs.existsSync(config.uploadDir)) {
      fs.cpSync(config.uploadDir, targetUploads, { recursive: true });
    }

    fs.writeFileSync(path.join(targetDir, "manifest.json"), JSON.stringify({
      created_at: new Date().toISOString(),
      database: "saddle-stone.sqlite",
      uploads: "uploads/",
      note: "Secrets are intentionally excluded."
    }, null, 2) + "\n");

    res.status(201).json({ ok: true, backup: { name } });
  } catch (error) {
    console.error("Backup creation failed:", error);
    res.status(500).json({ error: "Backup creation failed." });
  }
});

app.get("/api/admin/users", ownerRequired, (_req, res) => {
  const users = db.prepare(`
    SELECT id, email, display_name, role, created_at, updated_at
    FROM admins
    ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, email
  `).all();
  res.json({ users });
});

app.post("/api/admin/users", ownerRequired, csrfRequired, (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const displayName = text(req.body?.display_name, 120);
    const password = String(req.body?.password || "");
    if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email is required." });
    if (password.length < 12) return res.status(400).json({ error: "Temporary password must be at least 12 characters." });
    if (db.prepare("SELECT id FROM admins WHERE email = ?").get(email)) {
      return res.status(409).json({ error: "An administrator with that email already exists." });
    }

    const { salt, hash } = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO admins(email, password_salt, password_hash, display_name, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(email, salt, hash, displayName);

    const user = db.prepare(`
      SELECT id, email, display_name, role, created_at, updated_at
      FROM admins WHERE id = ?
    `).get(Number(result.lastInsertRowid));

    res.status(201).json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/admin/users/:id", ownerRequired, csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    if (id === req.auth.admin_id) return res.status(400).json({ error: "You cannot remove your own owner account." });

    const target = db.prepare("SELECT id, role FROM admins WHERE id = ?").get(id);
    if (!target) return res.status(404).json({ error: "Administrator not found." });
    if (target.role === "owner") return res.status(400).json({ error: "The owner account cannot be removed here." });

    db.prepare("DELETE FROM admins WHERE id = ?").run(id);
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.get("/api/admin/summary", (_req, res) => {
  const stats = {
    total_items: Number(db.prepare("SELECT COUNT(*) AS c FROM items").get().c),
    available_items: Number(db.prepare("SELECT COUNT(*) AS c FROM items WHERE status = 'available'").get().c),
    pending_items: Number(db.prepare("SELECT COUNT(*) AS c FROM items WHERE status = 'pending'").get().c),
    sold_items: Number(db.prepare("SELECT COUNT(*) AS c FROM items WHERE status = 'sold'").get().c),
    hidden_items: Number(db.prepare("SELECT COUNT(*) AS c FROM items WHERE status = 'hidden'").get().c),
    published_sales: Number(db.prepare("SELECT COUNT(*) AS c FROM sales WHERE status = 'published'").get().c),
    new_inquiries: Number(db.prepare("SELECT COUNT(*) AS c FROM inquiries WHERE status = 'new'").get().c)
  };
  res.json({ stats });
});

app.get("/api/admin/export.json", (_req, res) => {
  const exportData = {
    exported_at: new Date().toISOString(),
    format_version: 1,
    sales: db.prepare("SELECT * FROM sales ORDER BY id").all(),
    items: db.prepare("SELECT * FROM items ORDER BY id").all(),
    item_images: db.prepare("SELECT * FROM item_images ORDER BY item_id, sort_order, id").all(),
    inquiries: db.prepare("SELECT * FROM inquiries ORDER BY id").all()
  };
  res.setHeader("Content-Disposition", `attachment; filename="saddle-stone-export-${new Date().toISOString().slice(0,10)}.json"`);
  res.json(exportData);
});

app.post("/api/admin/change-password", csrfRequired, (req, res) => {
  try {
    rotateAdminPassword(
      req.auth.admin_id,
      String(req.body?.current_password || ""),
      String(req.body?.new_password || "")
    );
    // Password rotation destroys the current session too.
    res.setHeader("Set-Cookie", "ss_owner_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

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

app.delete("/api/admin/items/:id/permanent", csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const item = db.prepare("SELECT id, title, item_code FROM items WHERE id = ?").get(id);
    if (!item) return res.status(404).json({ error: "Item not found." });

    const images = db.prepare(
      "SELECT filename FROM item_images WHERE item_id = ?"
    ).all(id);

    db.exec("BEGIN IMMEDIATE");
    try {
      // Foreign-key cascades remove item_images and inquiries.
      db.prepare("DELETE FROM items WHERE id = ?").run(id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    // Remove image files after the database commit. Missing files are harmless.
    for (const image of images) {
      try {
        fs.unlinkSync(path.join(config.uploadDir, image.filename));
      } catch {}
    }

    res.json({
      ok: true,
      deleted: {
        id,
        item_code: item.item_code,
        title: item.title,
        images_removed: images.length
      }
    });
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
    if (files.some(file => !allowed.has(file.mimetype))) {
      return res.status(415).json({ error: "Only JPEG, PNG and WebP images are accepted." });
    }

    const created = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

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

app.delete("/api/admin/sales/:id", csrfRequired, (req, res) => {
  try {
    const id = requirePositiveId(req.params.id);
    const sale = db.prepare("SELECT id, title FROM sales WHERE id = ?").get(id);
    if (!sale) return res.status(404).json({ error: "Sale not found." });

    const linkedItems = Number(db.prepare(
      "SELECT COUNT(*) AS count FROM items WHERE sale_id = ?"
    ).get(id).count);

    // FK rule is ON DELETE SET NULL, so catalog items are preserved as standalone.
    db.prepare("DELETE FROM sales WHERE id = ?").run(id);

    res.json({
      ok: true,
      deleted: {
        id: sale.id,
        title: sale.title,
        items_made_standalone: linkedItems
      }
    });
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
