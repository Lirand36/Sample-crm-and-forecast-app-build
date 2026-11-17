"use client";

// How the engine placed this deal, gate by gate: the same order classification.ts applies, shown as a chain.

import type { ForecastLine } from "@/domain/forecast";
import { formatDisplayDate } from "@/domain/dates";
import {
  COMMITMENT_LABEL,
  GROUP_LABEL,
  READINESS_LABEL,
} from "@/features/shell/labels";

type Mark = "pass" | "partial" | "fail" | "skip";

const COUNTED = ["signed", "firm", "core"];

export function DecisionTrail({ line }: { line: ForecastLine }) {
  if (line.eligibility.kind !== "evaluated") return null;
  const c = line.commitment!;
  const t = line.view.timing;
  const committed = c.level === "committed";
  const direct = (type: string) =>
    line.view.states.find((s) => s.type === type)?.doneGrade === "direct";
  const waived = line.view.states.some((s) => s.state === "waived");

  const gates: { title: string; mark: Mark; value: string; note: string }[] = [
    {
      title: "In the forecast",
      mark: "pass",
      value: "Open, with a TCV",
      note: "Lost, PAYG, archived and no-TCV deals stop here.",
    },
    {
      title: "Customer committed",
      mark: committed ? "pass" : c.level === "engaged" ? "partial" : "fail",
      value: COMMITMENT_LABEL[c.level],
      note: committed
        ? `Sponsor, budget and vendor selection done; last reply ${c.latestEngagement ? formatDisplayDate(c.latestEngagement) : "—"}.`
        : c.missing.length
          ? `Missing: ${c.missing.join("; ")}.`
          : "Not every commercial step is done.",
    },
    {
      title: "Fits the quarter",
      mark:
        t.readiness === "slow"
          ? "pass"
          : t.readiness === "standard"
            ? "pass"
            : t.readiness === "fast"
              ? "partial"
              : "fail",
      value: READINESS_LABEL[t.readiness],
      note:
        t.esd.standard !== null
          ? `Standard pace signs ${formatDisplayDate(t.esd.standard)}.`
          : t.missingFast
            ? "A step has no estimate, so there is no date."
            : "No date.",
    },
    {
      title: "Proof in writing",
      mark:
        !committed || t.readiness !== "slow"
          ? "skip"
          : direct("budget") && direct("vendor_selection") && !waived
            ? "pass"
            : "partial",
      value:
        !committed || t.readiness !== "slow"
          ? "Not reached"
          : direct("budget") && direct("vendor_selection") && !waived
            ? "Budget and award in writing"
            : "Not all in writing",
      note: "Firm needs a written budget and award, no waiver, and room even at slow pace.",
    },
  ];

  const counted = COUNTED.includes(line.group);
  return (
    <div
      className="trail"
      data-testid="decision-trail"
      aria-label="How the system placed this deal"
    >
      {gates.map((g, i) => (
        <div key={g.title} className={`gate m-${g.mark}`}>
          <span className="gate-step" aria-hidden>
            {i + 1}
          </span>
          <span className="gate-title">{g.title}</span>
          <strong className="gate-value">{g.value}</strong>
          <span className="gate-note">{g.note}</span>
        </div>
      ))}
      <div className={`gate result ${counted ? "counted" : "out"}`}>
        <span className="gate-title">Result</span>
        <span className={`group-pill g-${line.group}`}>
          {GROUP_LABEL[line.group]}
        </span>
        <span className="gate-note">
          {counted
            ? "Counts in the system forecast."
            : line.group === "stretch"
              ? "Counts only in the upside."
              : "Not counted this quarter."}
        </span>
      </div>
    </div>
  );
}
