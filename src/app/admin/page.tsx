"use client";

import { useState } from "react";
import { formatDisplayDate } from "@/domain/dates";
import { useStore } from "@/features/shell/StoreProvider";

export default function AdminPage() {
  const { reset, session } = useStore();
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done">("idle");

  async function restore() {
    setState("busy");
    await reset();
    setState("done");
  }

  return (
    <section>
      <h1>Administration</h1>
      <div className="panel">
        <h2>Restore baseline data</h2>
        <p>
          Puts every Account, Contact, Opportunity, activity record and forecast run back to the baseline of{" "}
          {formatDisplayDate(session.asOfDate)}, and undoes all changes made since. Use it to start a walkthrough from a
          known state.
        </p>
        {state === "confirm" ? (
          <div className="form-actions">
            <button type="button" className="btn btn-danger" onClick={restore} data-testid="reset">
              Yes, restore baseline
            </button>
            <button type="button" className="btn" onClick={() => setState("idle")}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setState("confirm")} disabled={state === "busy"} data-testid="reset-start">
              {state === "busy" ? "Restoring…" : "Restore baseline data"}
            </button>
            {state === "done" ? <span className="muted">Baseline restored.</span> : null}
          </div>
        )}
      </div>
    </section>
  );
}
