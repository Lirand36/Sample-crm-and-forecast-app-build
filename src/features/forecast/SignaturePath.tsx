"use client";

// The deal's Signature Path drawn as a route: steps already done on the left (in order, compressed), today, then
// the open steps placed at their standard-pace finish date, the quarter end, and the planned signature.

import { useState, type ReactNode } from "react";
import {
  compareDates,
  daysBetween,
  formatDisplayDate,
  maxDate,
  type IsoDate,
} from "@/domain/dates";
import type { ConditionState } from "@/domain/condition-state";
import type { ConditionType } from "@/domain/entities";
import type { StepTiming } from "@/domain/timing";

export const SHORT_LABEL: Record<ConditionType, string> = {
  executive_sponsor: "Sponsor",
  budget: "Budget",
  pilot: "Pilot",
  vendor_selection: "Vendor selection",
  technical_validation: "Technical validation",
  security: "Security",
  procurement_legal: "Procurement and legal",
};

const STATE_WORD: Record<ConditionState["state"], string> = {
  done: "Done",
  waived: "Waived",
  in_progress: "In progress",
  blocked: "Blocked",
  not_started: "Not started",
};

const short = (x: IsoDate) => formatDisplayDate(x).replace(/, \d{4}$/, "");
const PAST = 34; // percent of the track for steps already done

export function SignaturePath(props: {
  states: readonly ConditionState[];
  steps: readonly StepTiming[];
  asOf: IsoDate;
  quarterEnd: IsoDate;
  signature: IsoDate | null;
  /** Flags shown on a station, e.g. "pilot at risk". */
  flags?: Partial<Record<ConditionType, { text: string; warn: boolean }>>;
  detail: (type: ConditionType) => ReactNode;
}) {
  const { states, steps, asOf, quarterEnd: qe, signature, flags = {} } = props;
  const [selected, setSelected] = useState<ConditionType | null>(null);

  const done = states
    .filter((s) => s.state === "done" || s.state === "waived")
    .sort((a, b) =>
      a.doneOn && b.doneOn
        ? compareDates(a.doneOn, b.doneOn)
        : a.doneOn
          ? -1
          : 1,
    );
  const open = states
    .filter((s) => s.state !== "done" && s.state !== "waived")
    .map((s) => ({ s, step: steps.find((x) => x.type === s.type)! }))
    .sort((a, b) => {
      const fa = a.step.finish.standard;
      const fb = b.step.finish.standard;
      return fa && fb ? compareDates(fa, fb) : fa ? -1 : fb ? 1 : 0;
    });

  let end = qe;
  for (const { step } of open)
    if (step.finish.standard) end = maxDate(end, step.finish.standard);
  if (signature) end = maxDate(end, signature);
  const span = Math.max(daysBetween(asOf, end), 1);
  const futureX = (x: IsoDate) =>
    PAST + 4 + (daysBetween(asOf, x) / span) * (100 - PAST - 8);
  const pastX = (i: number) =>
    done.length === 1
      ? PAST / 2
      : 3 + (i / Math.max(done.length - 1, 1)) * (PAST - 9);
  const qeX = futureX(qe);
  let signX = signature ? futureX(signature) : 100 - 2;
  const inQuarter = signature !== null && compareDates(signature, qe) <= 0;

  type Station = {
    type: ConditionType;
    x: number;
    date: IsoDate | null;
    kind: string;
    label: string;
  };
  const stations: Station[] = [
    ...done.map((s, i) => ({
      type: s.type,
      x: pastX(i),
      date: s.doneOn,
      kind: s.state,
      label:
        s.state === "waived" ? "Waived" : s.doneOn ? short(s.doneOn) : "Done",
    })),
    ...open.map(({ s, step }, i) => ({
      type: s.type,
      x: step.finish.standard ? futureX(step.finish.standard) : 100 - 6 - i * 3,
      date: step.finish.standard,
      kind: s.state,
      label: step.finish.standard ? short(step.finish.standard) : "No estimate",
    })),
  ];

  // Two stations on the same day would hide each other: nudge the later one along the line.
  const placed = [...stations].sort((a, b) => a.x - b.x);
  for (let i = 1; i < placed.length; i++)
    if (placed[i]!.x - placed[i - 1]!.x < 2.2)
      placed[i]!.x = placed[i - 1]!.x + 2.2;

  // The signature comes after the last step it waits for.
  const lastOpen = placed
    .filter((p) => p.date !== null && !["done", "waived"].includes(p.kind))
    .at(-1);
  if (lastOpen && signX - lastOpen.x < 2.6) signX = lastOpen.x + 2.6;

  // Labels go above or below the line, on the first row with room; the signature's label sits below.
  const taken: Record<"above" | "below", number[][]> = {
    above: [[], []],
    below: [[signX], []],
  };
  const slot = new Map<
    ConditionType,
    { side: "above" | "below"; row: number }
  >();
  for (const st of placed) {
    const room = (k: "above" | "below", r: number) =>
      Math.min(100, ...taken[k][r]!.map((x) => Math.abs(x - st.x)));
    const options = [
      ["above", 0],
      ["below", 0],
      ["above", 1],
      ["below", 1],
    ] as const;
    const pick =
      options.find(([k, r]) => room(k, r) >= 13) ??
      options.reduce((a, b) => (room(b[0], b[1]) > room(a[0], a[1]) ? b : a));
    taken[pick[0]][pick[1]]!.push(st.x);
    slot.set(st.type, { side: pick[0], row: pick[1] });
  }

  const toggle = (t: ConditionType) =>
    setSelected((cur) => (cur === t ? null : t));

  return (
    <div className="sp" data-testid="signature-path">
      <div className="sp-track">
        <span className="sp-line past" style={{ left: 0, width: `${PAST}%` }} />
        <span
          className="sp-line future"
          style={{
            left: `${PAST}%`,
            width: `${(inQuarter ? signX : Math.min(qeX, signX)) - PAST}%`,
          }}
        />
        {signX > qeX && !inQuarter ? (
          <span
            className="sp-line late"
            style={{ left: `${qeX}%`, width: `${signX - qeX}%` }}
          />
        ) : null}
        <span className="sp-today" style={{ left: `${PAST}%` }}>
          <span>Today</span>
          <span className="sp-sub">{short(asOf)}</span>
        </span>
        <span className="sp-qe" style={{ left: `${qeX}%` }}>
          <span>Quarter end</span>
          <span className="sp-sub">{short(qe)}</span>
        </span>
        {stations.map((st) => (
          <button
            key={st.type}
            type="button"
            className={`sp-station k-${st.kind}${slot.get(st.type)?.side === "below" ? " below" : ""}${slot.get(st.type)?.row ? " row2" : ""}${selected === st.type ? " on" : ""}${flags[st.type]?.warn ? " flagged" : ""}`}
            style={{ left: `${st.x}%` }}
            onClick={() => toggle(st.type)}
            aria-pressed={selected === st.type}
            title={`${SHORT_LABEL[st.type]}: ${STATE_WORD[st.kind as ConditionState["state"]]}`}
          >
            <span className="sp-dot" />
            <span className="sp-text">
              <strong>{SHORT_LABEL[st.type]}</strong>
              <span className="sp-sub">{flags[st.type]?.text ?? st.label}</span>
            </span>
          </button>
        ))}
        <span
          className={`sp-sign${inQuarter ? " fits" : " misses"}`}
          style={{ left: `${signX}%` }}
        >
          <span className="sp-diamond" />
          <span className="sp-text">
            <strong>Signature</strong>
            <span className="sp-sub">
              {signature ? short(signature) : "No estimate"}
            </span>
          </span>
        </span>
      </div>

      <ol className="sp-list">
        {stations.map((st) => (
          <li key={st.type}>
            <button
              type="button"
              className={`sp-row k-${st.kind}${selected === st.type ? " on" : ""}`}
              onClick={() => toggle(st.type)}
              aria-pressed={selected === st.type}
            >
              <span className="sp-dot" />
              <strong>{SHORT_LABEL[st.type]}</strong>
              <span className="sp-sub">
                {flags[st.type]?.text ??
                  `${STATE_WORD[st.kind as ConditionState["state"]]}, ${st.label}`}
              </span>
            </button>
          </li>
        ))}
        <li className={`sp-row sign${inQuarter ? " fits" : " misses"}`}>
          <span className="sp-diamond" />
          <strong>Signature</strong>
          <span className="sp-sub">
            {signature
              ? `${short(signature)}, ${inQuarter ? "in the quarter" : "after the quarter"}`
              : "No estimate"}
          </span>
        </li>
      </ol>

      <p className="sp-legend muted small">
        Filled: done. Half: in progress. Red: blocked. Open: not started. Open
        steps sit at their standard-pace finish. Select a step to see its
        evidence.
      </p>
      {selected ? (
        <div className="sp-detail" data-testid="path-detail">
          {props.detail(selected)}
        </div>
      ) : null}
    </div>
  );
}
