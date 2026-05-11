/**
 * GET /api/sheet — returns all sheet rows (proxied from Apps Script).
 * Auth: Authorization: Bearer <ADMIN_TOKEN> (set in Vercel + .env.local).
 */

function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (!h || typeof h !== "string") return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const bearer = getBearer(req);
  if (!adminToken || bearer !== adminToken) {
    return res.status(401).json({
      ok: false,
      error:
        "Wrong admin token — use the exact ADMIN_TOKEN from Vercel env (or .env.local locally).",
    });
  }

  const webAppUrl = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  const adminSecret = process.env.APPS_SCRIPT_ADMIN_SECRET?.trim();
  if (!webAppUrl) {
    return res.status(500).json({
      ok: false,
      error: "Server missing APPS_SCRIPT_WEB_APP_URL",
    });
  }
  if (!adminSecret) {
    return res.status(500).json({
      ok: false,
      error:
        "Server missing APPS_SCRIPT_ADMIN_SECRET (must match Apps Script script property ADMIN_SECRET).",
    });
  }

  let listUrl;
  try {
    const u = new URL(webAppUrl);
    u.searchParams.set("action", "list");
    u.searchParams.set("adminSecret", adminSecret);
    listUrl = u.toString();
  } catch {
    return res.status(500).json({ ok: false, error: "Invalid APPS_SCRIPT_WEB_APP_URL" });
  }

  try {
    const r = await fetch(listUrl, {
      method: "GET",
      redirect: "follow",
    });
    const text = await r.text();
    let out;
    try {
      out = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "Apps Script returned non-JSON",
      });
    }
    if (!out.ok) {
      const msg =
        out.error === "Unauthorized"
          ? "Sheet list denied: set Apps Script Script property ADMIN_SECRET to match APPS_SCRIPT_ADMIN_SECRET (Vercel env), then redeploy the Web App."
          : out.error || "Apps Script error";
      return res.status(403).json({ ok: false, error: msg });
    }
    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        error: out.error || text || "Apps Script HTTP error",
      });
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "Proxy request failed",
    });
  }
}
