/**
 * Container-bound script: open your target sheet → Extensions → Apps Script,
 * paste this file, Save, then Deploy → New deployment → type "Web app" → Execute as: Me,
 * Who has access: Anyone (or "Anyone with Google account" if you prefer).
 * Copy the Web app URL into Vercel: APPS_SCRIPT_WEB_APP_URL
 *
 * Optional: Script settings → Project Settings → Script properties → add SUBMIT_SECRET
 * and the same value in Vercel APPS_SCRIPT_SUBMIT_SECRET (proxied server-side only).
 */

var SHEET_HEADERS = [
  "Timestamp",
  "FA Name",
  "AC Number",
  "Vote 2021",
  "Vote 2026",
  "Switched",
  "Why 2026 alliance",
  "Why reason",
];

var TAB_NAME = "Sheet1";

/** DocumentProperties = per spreadsheet; avoids re-reading row 1 on every POST. */
var HEADERS_FLAG = "SURVEY_HEADERS_V1";

/**
 * Opening the /exec URL in a browser sends GET. Warms the instance; submissions use POST.
 */
function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      message:
        "Survey webhook is running. The form sends data with POST (JSON), not by opening this link.",
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var parsed = parseAndValidatePost_(e);
  if (parsed.error) {
    return jsonOut_(parsed.error);
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) {
    return jsonOut_({ ok: false, error: "Server busy, try again in a moment." });
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TAB_NAME);
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }
    ensureHeaders_(sheet);
    var row = rowFromPayload_(parsed.body);
    sheet.appendRow(row);
    return jsonOut_({ ok: true });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message || String(err) });
  } finally {
    lock.releaseLock();
  }
}

function parseAndValidatePost_(e) {
  var raw = e.postData && e.postData.contents;
  if (!raw) {
    return { error: { ok: false, error: "Empty body" } };
  }

  var body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return { error: { ok: false, error: "Invalid JSON" } };
  }

  var p = PropertiesService.getScriptProperties();
  var expected = p.getProperty("SUBMIT_SECRET");
  if (expected && body.submitSecret !== expected) {
    return { error: { ok: false, error: "Unauthorized" } };
  }

  var validationErrs = validate_(body);
  if (validationErrs.length) {
    return { error: { ok: false, error: validationErrs.join("; ") } };
  }

  if (body.switched) {
    var w = body.why2026;
    if (!w || typeof w !== "object" || !String(w.alliance || "").trim()) {
      return { error: { ok: false, error: "why2026.alliance required when switched is true" } };
    }
    if (w.reason == null || w.reason === "") {
      return { error: { ok: false, error: "why2026.reason required when switched is true" } };
    }
  }

  return { body: body };
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function validate_(body) {
  if (!body || typeof body !== "object") {
    return ["Invalid JSON body"];
  }
  var errs = [];

  if (!String(body.faName || "").trim()) {
    errs.push("faName required");
  }
  if (!String(body.acNumber || "").trim()) {
    errs.push("acNumber required");
  }
  if (!String(body.vote2021 || "").trim()) {
    errs.push("vote2021 required");
  }
  if (!String(body.vote2026 || "").trim()) {
    errs.push("vote2026 required");
  }
  if (typeof body.switched !== "boolean") {
    errs.push("switched must be boolean");
  }
  return errs;
}

function formatReasonDetail_(reason) {
  if (reason == null) {
    return "";
  }
  if (typeof reason === "string") {
    return reason;
  }
  if (reason && reason.code === "other" && reason.text) {
    return "other: " + reason.text;
  }
  try {
    return JSON.stringify(reason);
  } catch (e2) {
    return String(reason);
  }
}

function rowFromPayload_(body) {
  var ts = new Date().toISOString();
  var switched = Boolean(body.switched);
  var faName = String(body.faName || "").trim();
  var acNumber = String(body.acNumber || "").trim();
  var v21 = String(body.vote2021 || "").trim();
  var v26 = String(body.vote2026 || "").trim();

  var whyAlliance = "";
  var whyReason = "";
  if (switched && body.why2026 && typeof body.why2026 === "object") {
    whyAlliance = String(body.why2026.alliance || "").trim();
    whyReason = formatReasonDetail_(body.why2026.reason);
  }

  return [
    ts,
    faName,
    acNumber,
    v21,
    v26,
    switched ? "Yes" : "No",
    whyAlliance,
    whyReason,
  ];
}

function ensureHeaders_(sheet) {
  var doc = PropertiesService.getDocumentProperties();
  if (doc.getProperty(HEADERS_FLAG) === "1") {
    return;
  }
  var first = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  if (first && String(first[0] || "").trim() !== "") {
    doc.setProperty(HEADERS_FLAG, "1");
    return;
  }
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  doc.setProperty(HEADERS_FLAG, "1");
}
