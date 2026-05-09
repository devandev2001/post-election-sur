import { useEffect, useMemo, useState } from "react";
import { ALLIANCES, FA_NAMES, REASONS_BY_2026, VOTE_2021_OPTIONS } from "./surveyConfig";
import "./App.css";

const initialErrors = () => ({
  faName: "",
  acNumber: "",
  vote2021: "",
  vote2026: "",
  whyReason: "",
});

function buildPayloadSame(state) {
  const { faName, acNumber, vote2021, vote2026 } = state;
  return {
    faName,
    acNumber,
    vote2021,
    vote2026,
    switched: false,
  };
}

function buildPayloadSwitch(state) {
  const { faName, acNumber, vote2021, vote2026, whyReasonId, whyOtherText } =
    state;
  let reasonDetail = whyReasonId;
  if (whyReasonId === "other") {
    reasonDetail = { code: "other", text: whyOtherText.trim() };
  }
  return {
    faName,
    acNumber,
    vote2021,
    vote2026,
    switched: true,
    why2026: { alliance: vote2026, reason: reasonDetail },
  };
}

async function submitRow(body) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(
      data.error || `${res.status} ${res.statusText}` || "Submit failed"
    );
  }
}

export default function App() {
  const [faName, setFaName] = useState("");
  const [acNumber, setAcNumber] = useState("");
  const [vote2021, setVote2021] = useState("");
  const [vote2026, setVote2026] = useState("");
  const [whyReasonId, setWhyReasonId] = useState("");
  const [whyOtherText, setWhyOtherText] = useState("");
  const [errors, setErrors] = useState(initialErrors);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  /** pending = saving in background; saved | error = finished */
  const [syncState, setSyncState] = useState("idle");
  const [lastPayload, setLastPayload] = useState(null);

  useEffect(() => {
    fetch("/api/warmup").catch(() => {});
  }, []);

  const needsWhy = Boolean(
    vote2021 && vote2026 && vote2021 !== vote2026
  );

  const reasons = useMemo(() => {
    if (!vote2026) return [];
    return REASONS_BY_2026[vote2026] ?? REASONS_BY_2026.UDF;
  }, [vote2026]);

  const state = useMemo(
    () => ({
      faName,
      acNumber,
      vote2021,
      vote2026,
      whyReasonId,
      whyOtherText,
    }),
    [faName, acNumber, vote2021, vote2026, whyReasonId, whyOtherText]
  );

  useEffect(() => {
    if (!needsWhy) {
      setWhyReasonId("");
      setWhyOtherText("");
      setErrors((e) => ({ ...e, whyReason: "" }));
    }
  }, [needsWhy]);

  function clearFieldError(key) {
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    const next = initialErrors();
    let ok = true;
    if (!faName) {
      next.faName = "Select FA name.";
      ok = false;
    }
    if (!acNumber.trim()) {
      next.acNumber = "Enter AC number.";
      ok = false;
    }
    if (!vote2021) {
      next.vote2021 = "Select 2021 vote.";
      ok = false;
    }
    if (!vote2026) {
      next.vote2026 = "Select 2026 vote.";
      ok = false;
    }
    if (needsWhy) {
      if (!whyReasonId) {
        next.whyReason = "Select a reason.";
        ok = false;
      } else if (whyReasonId === "other" && !whyOtherText.trim()) {
        next.whyReason = "Please specify other reason.";
        ok = false;
      }
    }
    setErrors(next);
    if (!ok) return;

    const payload = needsWhy
      ? buildPayloadSwitch(state)
      : buildPayloadSame(state);

    setSubmitError("");
    setLastPayload(payload);
    setDone(true);
    setSyncState("pending");

    void (async () => {
      try {
        await submitRow(payload);
        setSyncState("saved");
        setLastPayload(null);
      } catch (err) {
        setSyncState("error");
        setSubmitError(
          err instanceof Error ? err.message : "Could not save to the sheet."
        );
      }
    })();
  }

  function retrySave() {
    if (!lastPayload) return;
    setSubmitError("");
    setSyncState("pending");
    void (async () => {
      try {
        await submitRow(lastPayload);
        setSyncState("saved");
        setLastPayload(null);
      } catch (err) {
        setSyncState("error");
        setSubmitError(
          err instanceof Error ? err.message : "Could not save to the sheet."
        );
      }
    })();
  }

  function restart() {
    setFaName("");
    setAcNumber("");
    setVote2021("");
    setVote2026("");
    setWhyReasonId("");
    setWhyOtherText("");
    setErrors(initialErrors());
    setSubmitError("");
    setDone(false);
    setSyncState("idle");
    setLastPayload(null);
  }

  if (done) {
    return (
      <div className="wrap">
        <h1>Voting pattern</h1>
        <div className="card card--done">
          <h2 className="done-title">Thank you</h2>
          {syncState === "pending" ? (
            <p className="done-text done-text--pending">
              Saving to the spreadsheet…
            </p>
          ) : syncState === "error" ? (
            <>
              <p className="done-text">
                We could not confirm the save. Use <strong>Retry save</strong> to
                send the same response again.
              </p>
              {submitError ? (
                <p className="form-error form-error--compact">{submitError}</p>
              ) : null}
              <div className="actions actions-center actions-stack">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={retrySave}
                  disabled={!lastPayload}
                >
                  Retry save
                </button>
                <button type="button" className="btn btn-secondary" onClick={restart}>
                  Edit responses
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="done-text">
                Your response has been saved to the spreadsheet.
              </p>
              <div className="actions actions-center">
                <button type="button" className="btn btn-secondary" onClick={restart}>
                  Submit another response
                </button>
              </div>
            </>
          )}
          {syncState === "pending" ? (
            <div className="actions actions-center">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={restart}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header className="page-header">
        <h1>Voting pattern</h1>
        <p className="hint">
          <span className="req">*</span> All fields marked are required. Use the
          dropdowns to choose each answer.
        </p>
      </header>

      <form className="form-stack" onSubmit={(e) => void handleSubmit(e)} noValidate>
        <section className="card">
          <h2 className="section-heading">Enumerator</h2>
          <p className="section-lead">Who is collecting this response and which AC?</p>

          <div className="field">
            <label className="field-label" htmlFor="faName">
              FA name <span className="req">*</span>
            </label>
            <div className="select-wrap">
              <select
                id="faName"
                className="select"
                value={faName}
                onChange={(e) => {
                  setFaName(e.target.value);
                  clearFieldError("faName");
                }}
              >
                <option value="">Select FA name</option>
                {FA_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            {errors.faName ? (
              <p className="field-error">{errors.faName}</p>
            ) : null}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="acNumber">
              AC number <span className="req">*</span>
            </label>
            <input
              id="acNumber"
              className="text-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 9"
              value={acNumber}
              onChange={(e) => {
                setAcNumber(e.target.value);
                clearFieldError("acNumber");
              }}
            />
            {errors.acNumber ? (
              <p className="field-error">{errors.acNumber}</p>
            ) : null}
          </div>
        </section>

        <section className="card">
          <h2 className="section-heading">Votes</h2>
          <p className="section-lead">
            Whom did the respondent vote for in each election?
          </p>

          <div className="field-grid">
            <div className="field">
              <label className="field-label" htmlFor="vote2021">
                Whom did you vote for in 2021? <span className="req">*</span>
              </label>
              <div className="select-wrap">
                <select
                  id="vote2021"
                  className="select"
                  value={vote2021}
                  onChange={(e) => {
                    setVote2021(e.target.value);
                    clearFieldError("vote2021");
                  }}
                >
                  <option value="">Select alliance</option>
                  {VOTE_2021_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              {errors.vote2021 ? (
                <p className="field-error">{errors.vote2021}</p>
              ) : null}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="vote2026">
                Whom did you vote for in 2026? <span className="req">*</span>
              </label>
              <div className="select-wrap">
                <select
                  id="vote2026"
                  className="select"
                  value={vote2026}
                  onChange={(e) => {
                    setVote2026(e.target.value);
                    clearFieldError("vote2026");
                  }}
                >
                  <option value="">Select alliance</option>
                  {ALLIANCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              {errors.vote2026 ? (
                <p className="field-error">{errors.vote2026}</p>
              ) : null}
            </div>
          </div>
        </section>

        {needsWhy ? (
          <section className="card card--why">
            <div className="section-banner">Why {vote2026}?</div>
            <p className="why-prompt">
              What is the reason for voting for the {vote2026}?{" "}
              <span className="req">*</span>
            </p>
            <ul className="radio-list">
              {reasons.map((r) => (
                <li key={r.id}>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="whyReason"
                      value={r.id}
                      checked={whyReasonId === r.id}
                      onChange={() => {
                        setWhyReasonId(r.id);
                        clearFieldError("whyReason");
                      }}
                    />
                    <span>{r.label}</span>
                  </label>
                  {r.other && whyReasonId === "other" ? (
                    <input
                      className="text-input other-input"
                      type="text"
                      placeholder="Please specify"
                      aria-label="Other reason"
                      value={whyOtherText}
                      onChange={(e) => {
                        setWhyOtherText(e.target.value);
                        clearFieldError("whyReason");
                      }}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            {errors.whyReason ? (
              <p className="field-error">{errors.whyReason}</p>
            ) : null}
          </section>
        ) : vote2021 && vote2026 ? (
          <p className="same-vote-note">
            2021 and 2026 choices match — no follow-up reason is required.
          </p>
        ) : null}

        {submitError ? <p className="form-error">{submitError}</p> : null}

        <div className="actions actions-footer">
          <button type="submit" className="btn btn-primary btn-lg">
            Submit to sheet
          </button>
        </div>
      </form>
    </div>
  );
}
