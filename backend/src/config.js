import path from "node:path";

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function int(name, fallback, min, max) {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

const dataDir = path.resolve(process.env.DATA_DIR || "/data");

export const config = {
  port: int("PORT", 8787, 1, 65535),
  dataDir,
  dbPath: path.join(dataDir, "saddle-stone.sqlite"),
  uploadDir: path.join(dataDir, "uploads"),
  backupDir: path.join(dataDir, "backups"),
  appOrigin: (process.env.APP_ORIGIN || "").replace(/\/$/, ""),
  cookieSecure: bool("COOKIE_SECURE", process.env.NODE_ENV === "production"),
  sessionDays: int("SESSION_DAYS", 7, 1, 30),
  trustProxy: bool("TRUST_PROXY", true),
  maxUploadMb: int("MAX_UPLOAD_MB", 12, 1, 25),
  maxImagesPerItem: int("MAX_IMAGES_PER_ITEM", 8, 1, 12)
};
