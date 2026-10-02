import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "saddle-stone-test-"));
const port = 18787;
const email = "test-owner@example.invalid";
const password = "correct horse battery staple";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/ready`);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("Backend did not become ready.");
}

async function request(url, options = {}, cookie = "") {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`http://127.0.0.1:${port}${url}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

const createAdmin = spawn(process.execPath, ["scripts/create-admin.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATA_DIR: tmp,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    COOKIE_SECURE: "false",
    APP_ORIGIN: ""
  },
  stdio: "inherit"
});

await new Promise((resolve, reject) => {
  createAdmin.on("exit", code => code === 0 ? resolve() : reject(new Error("create-admin failed")));
});

const server = spawn(process.execPath, ["src/server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DATA_DIR: tmp,
    COOKIE_SECURE: "false",
    APP_ORIGIN: "",
    SMTP_HOST: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

server.stdout.on("data", chunk => process.stdout.write(chunk));
server.stderr.on("data", chunk => process.stderr.write(chunk));

try {
  await waitForReady();

  const login = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!login.res.ok) throw new Error("Login failed.");

  const setCookie = login.res.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  const csrf = login.data.csrf_token;
  if (!cookie || !csrf) throw new Error("Session cookie or CSRF token missing.");

  const item = await request("/api/admin/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf
    },
    body: JSON.stringify({
      title: "Self Test Crock",
      category: "Vintage Decor",
      price_cents: 4500,
      status: "available",
      description: "Temporary automated test record."
    })
  }, cookie);
  if (item.res.status !== 201 || !item.data.item?.item_code) {
    throw new Error("Item creation failed.");
  }

  const catalog = await request("/api/catalog");
  if (!catalog.res.ok || catalog.data.total !== 1) {
    throw new Error("Public catalog read failed.");
  }

  const inquiry = await request(`/api/catalog/${item.data.item.slug}/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer",
      email: "customer@example.invalid",
      message: "Is this still available?"
    })
  });
  if (inquiry.res.status !== 201) throw new Error("Inquiry creation failed.");

  const summary = await request("/api/admin/summary", {}, cookie);
  if (!summary.res.ok || summary.data.stats?.new_inquiries !== 1) {
    throw new Error("Admin summary failed.");
  }

  const exportCheck = await request("/api/admin/export.json", {}, cookie);
  if (!exportCheck.res.ok || exportCheck.data.items?.length !== 1) {
    throw new Error("Portable export failed.");
  }

  console.log("SELF-TEST PASSED");
} finally {
  server.kill("SIGTERM");
  await sleep(250);
  fs.rmSync(tmp, { recursive: true, force: true });
}
