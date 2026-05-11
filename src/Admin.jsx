import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Admin.css";

const SHEET_FALLBACK = [
  "Timestamp",
  "FA Name",
  "AC Number",
  "Vote 2021",
  "Vote 2026",
  "Switched",
  "Why 2026 alliance",
  "Why reason",
];

function escapeCsvCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export default function Admin() {
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(async (authToken) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sheet", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || res.statusText || "Failed to load");
      }
      setColumns(Array.isArray(data.columns) ? data.columns : []);
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setUnlocked(true);
    } catch (e) {
      setUnlocked(false);
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      row.some((cell) =>
        String(cell ?? "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [rows, filter]);

  const stats = useMemo(() => {
    const idx2026 = columns.findIndex(
      (c) => String(c).trim().toLowerCase() === "vote 2026"
    );
    const map = {};
    rows.forEach((row) => {
      const v = idx2026 >= 0 ? String(row[idx2026] ?? "").trim() : "";
      if (!v) return;
      map[v] = (map[v] || 0) + 1;
    });
    return { total: rows.length, by2026: map };
  }, [rows, columns]);

  function handleUnlock(e) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Enter admin token.");
      return;
    }
    void load(token.trim());
  }

  function handleRefresh() {
    if (!token.trim()) return;
    void load(token.trim());
  }

  function exportCsv() {
    const cols = columns.length ? columns : SHEET_FALLBACK;
    const lines = [cols.map(escapeCsvCell).join(",")];
    rows.forEach((row) => {
      const padded = [...row];
      while (padded.length < cols.length) padded.push("");
      lines.push(
        cols.map((_, i) => escapeCsvCell(padded[i])).join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `survey-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-brand">
          <h1>Survey admin</h1>
          <p className="admin-sub">Responses from your Google Sheet</p>
        </div>
        <Link to="/" className="admin-link-home">
          ← Back to form
        </Link>
      </header>

      {!unlocked ? (
        <section className="admin-card admin-login">
          <h2>Sign in</h2>
          <p className="admin-login-hint">
            Use the same <strong>ADMIN_TOKEN</strong> value set in Vercel (and
            <code> .env.local</code> for local dev). This is not your Google password.
          </p>
          <form onSubmit={handleUnlock}>
            <label className="admin-label" htmlFor="adminToken">
              Admin token
            </label>
            <input
              id="adminToken"
              className="admin-input"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste admin token"
            />
            {error ? <p className="admin-error">{error}</p> : null}
            <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
              {loading ? "Checking…" : "Unlock dashboard"}
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="admin-toolbar">
            <div className="admin-toolbar-left">
              <input
                className="admin-search"
                type="search"
                placeholder="Filter rows…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="Filter table"
              />
              <span className="admin-count">
                {filteredRows.length} of {rows.length} rows
              </span>
            </div>
            <div className="admin-toolbar-right">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={exportCsv}
                disabled={!rows.length}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => {
                  setUnlocked(false);
                  setRows([]);
                  setColumns([]);
                  setFilter("");
                  setError("");
                }}
              >
                Lock
              </button>
            </div>
          </div>

          <section className="admin-stats">
            <div className="admin-stat">
              <span className="admin-stat-value">{stats.total}</span>
              <span className="admin-stat-label">Total responses</span>
            </div>
            {Object.entries(stats.by2026)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <div key={k} className="admin-stat admin-stat--sm">
                  <span className="admin-stat-value">{v}</span>
                  <span className="admin-stat-label">2026: {k}</span>
                </div>
              ))}
          </section>

          {error ? <p className="admin-error admin-error--banner">{error}</p> : null}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {(columns.length ? columns : SHEET_FALLBACK).map((col, i) => (
                    <th key={i}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(columns.length || SHEET_FALLBACK.length, 1)}
                      className="admin-empty"
                    >
                      {rows.length === 0
                        ? "No data rows yet."
                        : "No rows match your filter."}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, ri) => (
                    <tr key={ri}>
                      {(columns.length ? columns : SHEET_FALLBACK).map((_, ci) => (
                        <td key={ci}>{row[ci] != null ? String(row[ci]) : ""}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
