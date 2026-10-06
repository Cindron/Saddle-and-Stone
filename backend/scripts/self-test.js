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

  const sitemap = await fetch(`http://127.0.0.1:${port}/sitemap.xml`);
  const sitemapXml = await sitemap.text();
  if (!sitemap.ok || !sitemapXml.includes("/catalog/?item=" + item.data.item.slug)) {
    throw new Error("Dynamic sitemap failed.");
  }

  const catalogPage = await fetch(`http://127.0.0.1:${port}/catalog/`);
  const catalogHtml = await catalogPage.text();
  if (
    !catalogPage.ok ||
    !catalogHtml.includes("<title>Estate Sale Catalog &amp; Vintage Finds | Saddle &amp; Stone</title>") ||
    !catalogHtml.includes('id="catalogGrid"') ||
    catalogHtml.includes('content="noindex')
  ) {
    throw new Error("Customer catalog shell failed.");
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

  const settings = await request("/api/admin/site-settings", {}, cookie);
  if (!settings.res.ok || !settings.data.settings?.business_name) {
    throw new Error("Site settings read failed.");
  }

  const system = await request("/api/admin/system", {}, cookie);
  if (!system.res.ok || system.data.schema_version !== "3") {
    throw new Error("Maintenance system check failed.");
  }

  const sale = await request("/api/admin/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf
    },
    body: JSON.stringify({
      title: "Self Test Estate Sale",
      status: "published",
      start_at: "2026-10-15T09:00",
      end_at: "2026-10-15T15:00",
      city: "Peterborough",
      region: "Ontario"
    })
  }, cookie);
  if (sale.res.status !== 201) throw new Error("Sale creation failed.");

  const publicSales = await request("/api/sales");
  if (!publicSales.res.ok || publicSales.data.sales?.length !== 1) {
    throw new Error("Public sales feed failed.");
  }

  const calendarPage = await fetch(`http://127.0.0.1:${port}/calendar/`);
  const calendarHtml = await calendarPage.text();
  if (!calendarPage.ok || !calendarHtml.includes('id="calendarGrid"')) {
    throw new Error("Calendar shell failed.");
  }
  if (calendarHtml.includes('content="noindex')) {
    throw new Error("Calendar unexpectedly noindexed.");
  }

  const backup = await request("/api/admin/backups", {
    method: "POST",
    headers: { "X-CSRF-Token": csrf }
  }, cookie);
  if (backup.res.status !== 201 || !backup.data.backup?.name) {
    throw new Error("Portal backup failed.");
  }

  const removable = await request("/api/admin/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrf
    },
    body: JSON.stringify({
      title: "Temporary Deletion Test",
      status: "available"
    })
  }, cookie);
  if (removable.res.status !== 201) throw new Error("Deletion test item creation failed.");

  const removableId = removable.data.item.id;
  const hideCheck = await request("/api/admin/items/" + removableId, {
    method: "DELETE",
    headers: { "X-CSRF-Token": csrf }
  }, cookie);
  if (!hideCheck.res.ok || hideCheck.data.item?.status !== "hidden") {
    throw new Error("Item hide failed.");
  }

  const deleteCheck = await request("/api/admin/items/" + removableId + "/permanent", {
    method: "DELETE",
    headers: { "X-CSRF-Token": csrf }
  }, cookie);
  if (!deleteCheck.res.ok || deleteCheck.data.deleted?.id !== removableId) {
    throw new Error("Permanent item deletion failed.");
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
