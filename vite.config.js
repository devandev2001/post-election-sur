import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Mirrors api/submit.js so `npm run dev` can reach Apps Script without 404. */
function localAppsScriptProxy(env) {
  return {
    name: "local-apps-script-submit",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];

        if (path === "/api/sheet" && req.method === "GET") {
          const adminToken = env.ADMIN_TOKEN?.trim();
          const authRaw =
            req.headers.authorization || req.headers.Authorization || "";
          const m = typeof authRaw === "string" && authRaw.match(/^Bearer\s+(.+)$/i);
          const bearer = m ? m[1].trim() : null;
          if (!adminToken || bearer !== adminToken) {
            res.statusCode = 401;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error:
                  "Wrong admin token. Use the exact ADMIN_TOKEN from .env.local (restart npm run dev after editing).",
              })
            );
            return;
          }
          const webAppUrl = env.APPS_SCRIPT_WEB_APP_URL?.trim();
          const adminSecret = env.APPS_SCRIPT_ADMIN_SECRET?.trim();
          if (!webAppUrl || !adminSecret) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error:
                  "Missing APPS_SCRIPT_WEB_APP_URL or APPS_SCRIPT_ADMIN_SECRET in .env.local",
              })
            );
            return;
          }
          let listUrl;
          try {
            const u = new URL(webAppUrl);
            u.searchParams.set("action", "list");
            u.searchParams.set("adminSecret", adminSecret);
            listUrl = u.toString();
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Invalid web app URL" }));
            return;
          }
          try {
            const r = await fetch(listUrl, { method: "GET", redirect: "follow" });
            const text = await r.text();
            let out;
            try {
              out = JSON.parse(text);
            } catch {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "Apps Script returned non-JSON (check Web App URL / deployment).",
                })
              );
              return;
            }
            if (!out.ok) {
              const listErr =
                out.error === "Unauthorized"
                  ? "Sheet list denied: in Apps Script → Project settings → Script properties, add ADMIN_SECRET with the exact same value as APPS_SCRIPT_ADMIN_SECRET in .env.local, then Deploy → Manage deployments → New version."
                  : out.error || "Apps Script error";
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: listErr }));
              return;
            }
            if (!r.ok) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: out.error || text || "Apps Script HTTP error",
                })
              );
              return;
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(out));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ ok: false, error: e?.message || "Proxy failed" })
            );
          }
          return;
        }

        if (path === "/api/warmup" && req.method === "GET") {
          const webAppUrl = env.APPS_SCRIPT_WEB_APP_URL?.trim();
          if (!webAppUrl) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, warmed: false }));
            return;
          }
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 12000);
          try {
            const r = await fetch(webAppUrl, {
              method: "GET",
              redirect: "follow",
              signal: ctrl.signal,
            });
            await r.text();
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, warmed: true }));
          } catch {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, warmed: false }));
          } finally {
            clearTimeout(timer);
          }
          return;
        }

        if (path !== "/api/submit") {
          return next();
        }

        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
          return;
        }

        const webAppUrl = env.APPS_SCRIPT_WEB_APP_URL?.trim();
        if (!webAppUrl) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error:
                "Missing APPS_SCRIPT_WEB_APP_URL. Add it to .env.local for local dev.",
            })
          );
          return;
        }

        let raw;
        try {
          raw = await readRequestBody(req);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "Could not read body" }));
          return;
        }

        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
          return;
        }

        const payload = { ...body };
        const secret = env.APPS_SCRIPT_SUBMIT_SECRET;
        if (secret) {
          payload.submitSecret = secret;
        }

        try {
          const r = await fetch(webAppUrl, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const text = await r.text();
          let out;
          try {
            out = JSON.parse(text);
          } catch {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ ok: false, error: "Apps Script returned non-JSON" })
            );
            return;
          }
          if (!r.ok) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: out.error || text || "Apps Script error",
              })
            );
            return;
          }
          if (!out.ok) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: out.error || "Apps Script rejected payload",
              })
            );
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error: e?.message || "Proxy request failed",
            })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  return {
    plugins: [react(), localAppsScriptProxy(env)],
  };
});
