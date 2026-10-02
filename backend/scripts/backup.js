import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../src/config.js";

fs.mkdirSync(config.backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const targetDir = path.join(config.backupDir, `saddle-stone-${stamp}`);
const targetUploads = path.join(targetDir, "uploads");
fs.mkdirSync(targetUploads, { recursive: true });

const db = new DatabaseSync(config.dbPath);
const safeDbPath = path.join(targetDir, "saddle-stone.sqlite").replaceAll("'", "''");
db.exec(`VACUUM INTO '${safeDbPath}'`);
db.close();

if (fs.existsSync(config.uploadDir)) {
  fs.cpSync(config.uploadDir, targetUploads, { recursive: true });
}

const manifest = {
  created_at: new Date().toISOString(),
  database: "saddle-stone.sqlite",
  uploads: "uploads/",
  note: "Secrets are intentionally not included. Recreate backend/.env from backend/.env.example."
};
fs.writeFileSync(
  path.join(targetDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(targetDir);
