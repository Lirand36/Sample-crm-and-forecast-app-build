// An event's text. A call transcript shows one line per speaker: the customer's lines are what the extraction
// reads; our own side is shown dimmed, as context that never moves a step.

import type { DealEvent } from "@/domain/entities";

export function EventText({ e }: { e: DealEvent }) {
  if (e.sourceType !== "meeting_transcript" || e.id.startsWith("ev-slack-")) return <>{e.text}</>;
  const lines = e.text.split("\n").map((l) => {
    const i = l.indexOf(": ");
    return i < 0 ? { who: "", said: l } : { who: l.slice(0, i), said: l.slice(i + 2) };
  });
  return (
    <div className="transcript">
      {lines.map((l, k) => {
        const ours = l.who.includes("(Wonderful");
        return (
          <div key={k} className={ours ? "tr-line ours" : "tr-line"}>
            <span className="tr-who">
              {l.who}
              {ours ? <span className="tr-note"> · our side, not read</span> : null}
            </span>
            <span className="tr-said">{l.said}</span>
          </div>
        );
      })}
    </div>
  );
}
