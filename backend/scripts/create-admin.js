import readline from "node:readline";
import { db } from "../src/db.js";
import { hashPassword, normalizeEmail } from "../src/security.js";

function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, answer => {
    rl.close();
    resolve(answer);
  }));
}

function askSecret(prompt) {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive TTY required for password entry.");
  }

  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    let value = "";
    const onData = (ch) => {
      if (ch === "\u0003") process.exit(130);
      if (ch === "\r" || ch === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        return resolve(value);
      }
      if (ch === "\u007f") {
        if (value.length) value = value.slice(0, -1);
        return;
      }
      if (ch >= " ") value += ch;
    };
    process.stdin.on("data", onData);
  });
}

const email = normalizeEmail(process.env.ADMIN_EMAIL || await ask("Admin email: "));
if (!email || !email.includes("@")) throw new Error("A valid email is required.");

const password = process.env.ADMIN_PASSWORD || await askSecret("Admin password: ");
if (password.length < 12) {
  throw new Error("Use a password of at least 12 characters.");
}

const confirm = process.env.ADMIN_PASSWORD || await askSecret("Confirm password: ");
if (password !== confirm) throw new Error("Passwords did not match.");

const { salt, hash } = hashPassword(password);
const existing = db.prepare("SELECT id FROM admins WHERE email = ?").get(email);

if (existing) {
  db.prepare(`
    UPDATE admins
    SET password_salt = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(salt, hash, existing.id);
  console.log("Admin password updated.");
} else {
  db.prepare(`
    INSERT INTO admins(email, password_salt, password_hash)
    VALUES (?, ?, ?)
  `).run(email, salt, hash);
  console.log("Admin created.");
}

db.close();
