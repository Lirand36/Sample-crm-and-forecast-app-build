"use client";

import { useState } from "react";
import { advanceOneWeek } from "@/application/runs";
import { formatDisplayDate } from "@/domain/dates";
import { DEMO_AS_OF } from "@/seed/canonical";
import { PlanningStandards } from "@/features/admin/PlanningStandards";
import { useStore } from "@/features/shell/StoreProvider";

export default function AdminPage() {
  const { reset, session, store, refresh } = useStore();
  const [moving, setMoving] = useState(false);
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
        <h2>Move to next week</h2>
        <p>
          Today is {formatDisplayDate(session.asOfDate)}. This stores today&apos;s forecast run, moves the calendar forward seven days and
          loads the activity that arrives in that week, such as the next weekly pilot reading. The Forecast then shows what changed
          since this week.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            data-testid="next-week"
            disabled={moving}
            onClick={async () => {
              setMoving(true);
              await advanceOneWeek(store);
              await refresh();
              setMoving(false);
            }}
          >
            {moving ? "Moving…" : "Move to next week"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <PlanningStandards />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Restore baseline data</h2>
        <p>
          Puts every Account, Contact, Opportunity, activity record and forecast run back to the baseline of{" "}
          {formatDisplayDate(DEMO_AS_OF)}, and undoes all changes made since. Use it to start a walkthrough from a
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
