/**
 * Forwards submissions to your Google Apps Script Web App (server-side).
 * Browsers cannot reliably POST directly to script.google.com due to CORS.
 */

function parseJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return { error: "Invalid JSON" };
    }
  }
  if (!body || typeof body !== "object") {
    return { error: "Expected JSON object" };
  }
  return { data: body };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const webAppUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
  if (!webAppUrl || !String(webAppUrl).trim()) {
    return res.status(500).json({
      ok: false,
      error: "Server missing APPS_SCRIPT_WEB_APP_URL",
    });
  }

  const parsed = parseJsonBody(req);
  if (parsed.error) {
    return res.status(400).json({ ok: false, error: parsed.error });
  }

  const payload = { ...parsed.data };
  const secret = process.env.APPS_SCRIPT_SUBMIT_SECRET;
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
      return res.status(502).json({
        ok: false,
        error: "Apps Script returned non-JSON",
      });
    }

    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        error: out.error || text || "Apps Script error",
      });
    }

    if (!out.ok) {
      return res.status(400).json({
        ok: false,
        error: out.error || "Apps Script rejected payload",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    const msg = e?.message || "Proxy request failed";
    console.error("[submit]", msg);
    return res.status(500).json({ ok: false, error: msg });
  }
}
