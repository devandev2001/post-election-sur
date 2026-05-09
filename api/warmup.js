/**
 * GET /api/warmup — triggers a lightweight GET to the Apps Script Web App so the
 * first real submit is less likely to hit a cold start. Safe to ignore failures.
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const webAppUrl = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  if (!webAppUrl) {
    return res.status(200).json({ ok: true, warmed: false, reason: "no_url" });
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);

  try {
    const r = await fetch(webAppUrl, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
    });
    await r.text();
    return res.status(200).json({ ok: true, warmed: true });
  } catch {
    return res.status(200).json({ ok: true, warmed: false });
  } finally {
    clearTimeout(t);
  }
}
