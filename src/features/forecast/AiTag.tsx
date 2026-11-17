// Marks evidence that the extraction model read out of a synced message. Updates a manager logs from Slack
// are structured by the manager and carry no tag.

import type { DealEvent, Evidence } from "@/domain/entities";

export function AiTag({ e, ev }: { e: Evidence; ev: DealEvent }) {
  if (ev.id.startsWith("ev-slack-")) return null;
  return (
    <span
      className="ai-tag"
      title={`Read by the AI extraction model (${e.extractionVersion}) from the synced ${ev.channel}. The quote is copied verbatim and is checked against the source; the model never sets the forecast.`}
    >
      <span aria-hidden>✦</span> AI-extracted
    </span>
  );
}
