import crypto from "node:crypto";
import { db, cleanupExpiredSessions } from "./db.js";
import { config } from "./config.js";

const COOKIE_NAME = "ss_owner_session";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const normalized = String(password || "");
  const derived = crypto.scryptSync(normalized, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return { salt, hash: derived.toString("base64url") };
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(String(password || ""), salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024
    });
    const expected = Buffer.from(expectedHash, "base64url");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieOptions() {
  const parts = [
    `${COOKIE_NAME}=__TOKEN__`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${config.sessionDays * 86400}`
  ];
  if (config.cookieSecure) parts.push("Secure");
  return parts;
}

export function createSession(adminId, res) {
  cleanupExpiredSessions();

  const token = crypto.randomBytes(32).toString("base64url");
  const csrf = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionDays * 86400_000).toISOString();

  db.prepare(`
    INSERT INTO sessions(admin_id, token_hash, csrf_token, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(adminId, tokenHash(token), csrf, expiresAt);

  const cookie = cookieOptions().map((part, index) =>
    index === 0 ? part.replace("__TOKEN__", encodeURIComponent(token)) : part
  ).join("; ");

  res.setHeader("Set-Cookie", cookie);
  return { csrfToken: csrf, expiresAt };
}

export function clearSession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  }
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];
  if (config.cookieSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function authRequired(req, res, next) {
  cleanupExpiredSessions();
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Authentication required." });

  const row = db.prepare(`
    SELECT s.id AS session_id, s.csrf_token, s.expires_at,
           a.id AS admin_id, a.email
    FROM sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).get(tokenHash(token));

  if (!row) return res.status(401).json({ error: "Authentication required." });

  req.auth = row;
  next();
}

export function csrfRequired(req, res, next) {
  const sent = req.get("x-csrf-token") || "";
  const expected = req.auth?.csrf_token || "";
  if (!sent || sent.length !== expected.length) {
    return res.status(403).json({ error: "CSRF validation failed." });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!ok) return res.status(403).json({ error: "CSRF validation failed." });
  next();
}

export function originGuard(req, res, next) {
  if (!config.appOrigin) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  if (origin !== config.appOrigin) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  next();
}


export function rotateAdminPassword(adminId, currentPassword, newPassword) {
  const admin = db.prepare(`
    SELECT id, password_salt, password_hash
    FROM admins
    WHERE id = ?
  `).get(adminId);

  if (!admin || !verifyPassword(currentPassword, admin.password_salt, admin.password_hash)) {
    const error = new Error("Current password is incorrect.");
    error.status = 400;
    throw error;
  }

  if (String(newPassword || "").length < 12) {
    const error = new Error("New password must be at least 12 characters.");
    error.status = 400;
    throw error;
  }

  const { salt, hash } = hashPassword(newPassword);
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
      UPDATE admins
      SET password_salt = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(salt, hash, adminId);

    // Force every existing session to sign in with the new password.
    db.prepare("DELETE FROM sessions WHERE admin_id = ?").run(adminId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
