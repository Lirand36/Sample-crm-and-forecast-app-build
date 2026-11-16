// Minimal RFC 5322 reader for the bundled plain-text .eml fixtures (D-09 manual import).
// Supports unfolded headers and a text/plain body; that is all the fixtures and manual imports need.

export interface ParsedEml {
  from: string | null;
  to: string | null;
  date: string | null; // YYYY-MM-DD
  subject: string | null;
  messageId: string | null;
  body: string;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseRfcDate(value: string): string | null {
  const m = /(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/.exec(value);
  if (!m || !MONTHS[m[2]!]) return null;
  return `${m[3]}-${MONTHS[m[2]!]}-${m[1]!.padStart(2, "0")}`;
}

function extractAddress(value: string): string {
  const angle = /<([^>]+)>/.exec(value);
  return (angle ? angle[1]! : value).trim().toLowerCase();
}

export function parseEml(raw: string): ParsedEml {
  const text = raw.replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  const headerBlock = split === -1 ? text : text.slice(0, split);
  const body = split === -1 ? "" : text.slice(split + 2);
  const headers = new Map<string, string>();
  let last: string | null = null;
  for (const line of headerBlock.split("\n")) {
    if (/^\s/.test(line) && last) {
      headers.set(last, `${headers.get(last)} ${line.trim()}`);
      continue;
    }
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    last = line.slice(0, idx).trim().toLowerCase();
    headers.set(last, line.slice(idx + 1).trim());
  }
  const from = headers.get("from");
  const date = headers.get("date");
  return {
    from: from ? extractAddress(from) : null,
    to: headers.get("to") ?? null,
    date: date ? parseRfcDate(date) : null,
    subject: headers.get("subject") ?? null,
    messageId: headers.get("message-id") ?? null,
    body: body.trim(),
  };
}
