// "Your focus today": the few things the signed-in person should act on, by role.

import Link from "next/link";
import type { Evidence, User } from "@/domain/entities";
import type { Forecast } from "@/domain/forecast";
import { formatAmount, type Cents } from "@/domain/money";

interface Item {
  n: string;
  text: string;
  href: string;
  warn?: boolean;
}

export function Focus(props: { f: Forecast; me: User; users: readonly User[]; waiting: readonly Evidence[]; provisional: readonly Evidence[] }) {
  const { f, me, users } = props;
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? "";
  const lines = me.role === "sales_manager" ? f.lines.filter((l) => l.managerId === me.id) : f.lines;
  const mine = new Set(lines.map((l) => l.view.opportunity.id));
  const waiting = props.waiting.filter((e) => mine.has(e.opportunityId));
  const provisional = props.provisional.filter((e) => mine.has(e.opportunityId));
  const moves = lines.filter((l) => l.dispute && l.dispute.status.live);
  const missed = lines.filter((l) => l.dispute && !l.dispute.status.live && l.dispute.status.reason === "Bet missed");
  const c = f.company;
  const items: Item[] = [];

  if (me.role === "revops" || me.role === "sales_manager") {
    items.push({ n: String(waiting.length), text: "good news waiting for approval", href: "/evidence" });
    items.push({ n: String(provisional.length), text: "bad news to confirm", href: "/evidence", warn: provisional.length > 0 });
  }
  if (me.role === "revops") {
    items.push({ n: String(moves.length), text: "deals where a manager disagrees with the system", href: "/forecast#manager-commitment" });
    if (missed.length) items.push({ n: String(missed.length), text: "manager bets past their date", href: "/forecast#manager-commitment", warn: true });
  }
  if (me.role === "sales_manager") {
    const counted = lines.filter((l) => ["signed", "firm", "core"].includes(l.group)).reduce((a, l) => a + (l.tcv ?? 0), 0) as Cents;
    items.unshift({ n: formatAmount(counted), text: "of your deals signs this quarter", href: "/forecast" });
    items.push({ n: String(moves.length), text: moves.length === 1 ? "deal you moved in or out of Commit" : "deals you moved in or out of Commit", href: "/forecast#manager-commitment" });
  }
  if (me.role === "vp_sales" || me.role === "cro") {
    if (c.target !== null) items.push({ n: formatAmount(Math.max(0, c.target - c.core) as Cents), text: "short of the target", href: "/forecast", warn: c.core < c.target });
    for (const m of f.managers) {
      const gap = (m.managerCommitment - m.core) as Cents;
      items.push({
        n: `${gap >= 0 ? "+" : "−"}${formatAmount(Math.abs(gap) as Cents)}`,
        text: `${name(m.managerId)} vs the system`,
        href: "/forecast#manager-commitment",
        warn: Math.abs(gap) > 0,
      });
    }
  }
  const shown = items.filter((i) => i.n !== "0");
  if (!shown.length) return null;
  return (
    <section className="focus" aria-label="Your focus today">
      <h2>Your focus today</h2>
      <ul>
        {shown.map((i) => (
          <li key={i.text}>
            <Link href={i.href} className={i.warn ? "warn" : ""}>
              <strong>{i.n}</strong> <span>{i.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
