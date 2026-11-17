"use client";

// Forecast actions from Slack: a #forecast channel where Sales Managers run /forecast, and the live forecast
// beside it. Every action goes through the same application layer as the app itself, and the bot answers with
// what the action did to the numbers.

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { raiseDispute, withdrawDispute } from "@/application/disputes";
import { reviewEvidence } from "@/application/evidence";
import { loadForecast } from "@/application/forecast";
import { logCustomerUpdate, type CustomerUpdateKind } from "@/application/slack-update";
import { addDays, formatDisplayDate, type IsoDate } from "@/domain/dates";
import { CONDITION_LABEL, type ConditionType, type Contact, type User } from "@/domain/entities";
import { allowedActions } from "@/domain/evidence-review";
import { evidenceStatus } from "@/domain/condition-state";
import type { Forecast, ForecastLine } from "@/domain/forecast";
import { formatAmount, type Cents } from "@/domain/money";
import { columnOf, type Column } from "@/features/forecast/QuarterMap";
import { SHORT_LABEL } from "@/features/forecast/SignaturePath";
import { useStoreQuery } from "@/features/crm/ui";
import { useStore } from "@/features/shell/StoreProvider";

type Action = "good" | "bad" | "in" | "out" | "undo";

const ACTIONS: { key: Action; icon: string; title: string; hint: string }[] = [
  { key: "good", icon: "🟢", title: "Good news from the customer", hint: "A step started, moved or is done" },
  { key: "bad", icon: "🔴", title: "Bad news from the customer", hint: "A step is on hold" },
  { key: "in", icon: "⬆️", title: "Move a deal into Commit", hint: "Your call, with a bet the system checks daily" },
  { key: "out", icon: "⬇️", title: "Move a deal out of Commit", hint: "Your call, with the step you doubt" },
  { key: "undo", icon: "↩️", title: "Undo one of my moves", hint: "Withdraw a move into or out of Commit" },
];

const COLUMN_LABEL: Record<Column, string> = { yes: "Signs this quarter", maybe: "Could sign", no: "Not this quarter" };

interface Effect {
  core: [Cents, Cents];
  commit: [Cents, Cents];
  moved: { id: string; name: string; from: Column | null; to: Column | null }[];
}

type Msg =
  | { id: number; kind: "user"; author: string; text: string }
  | {
      id: number;
      kind: "bot";
      title: string;
      lines: string[];
      quote?: string;
      effect?: Effect;
      approval?: { evidenceId: string; opportunityId: string; state: "waiting" | "approved" | "rejected" };
      link?: { href: string; label: string };
      tone?: "good" | "bad" | "neutral";
    }
  | { id: number; kind: "menu" }
  | { id: number; kind: "note"; text: string; switchTo?: { userId: string; label: string; then: () => Promise<void> } };

type NewMsg = Msg extends infer M ? (M extends Msg ? Omit<M, "id"> : never) : never;

const short = (d: IsoDate) => formatDisplayDate(d).replace(/, \d{4}$/, "");

function effectOf(before: Forecast, after: Forecast): Effect {
  const prev = new Map(before.lines.map((l) => [l.view.opportunity.id, columnOf(l)]));
  const moved = after.lines
    .map((l) => ({ id: l.view.opportunity.id, name: l.view.account?.name ?? l.view.opportunity.name, from: prev.get(l.view.opportunity.id) ?? null, to: columnOf(l) }))
    .filter((m) => m.from !== m.to);
  return { core: [before.company.core, after.company.core], commit: [before.company.managerCommitment, after.company.managerCommitment], moved };
}

const QUOTES: Partial<Record<ConditionType, Record<"done" | "progress" | "started" | "blocked", string>>> = {
  vendor_selection: {
    done: "We have selected Wonderful as our vendor.",
    progress: "You are on our final shortlist.",
    started: "We are starting the vendor selection now.",
    blocked: "Vendor selection is on hold until the board meets.",
  },
  procurement_legal: {
    done: "Legal has approved the contract; it is ready to sign.",
    progress: "We sent back our comments on the contract.",
    started: "Procurement has started on the contract.",
    blocked: "Our legal review is on hold.",
  },
  security: {
    done: "Security has approved Wonderful.",
    progress: "The security questionnaire is in review.",
    started: "Security review has started.",
    blocked: "The security review is on hold.",
  },
  budget: {
    done: "The budget for this purchase is approved.",
    progress: "The budget request is with finance.",
    started: "We have asked finance for the budget.",
    blocked: "Budget approvals are frozen for now.",
  },
  executive_sponsor: {
    done: "I confirm I am the executive sponsor.",
    progress: "I will sponsor this internally.",
    started: "I am taking this to our leadership.",
    blocked: "I can't sponsor this until the reorganisation settles.",
  },
  pilot: {
    done: "We accept the pilot results.",
    progress: "The pilot numbers are improving week on week.",
    started: "The pilot is live.",
    blocked: "We are pausing the pilot.",
  },
  technical_validation: {
    done: "Integration testing is complete.",
    progress: "Integration testing is under way.",
    started: "Our engineers have started integration.",
    blocked: "Integration work is on hold.",
  },
};

export default function SlackPage() {
  const { store, actingUser, refresh: refreshStore, setActingUser, dismissImpact } = useStore();
  // The live panel already shows what changed; the app-wide "What that did" pop-up would cover it.
  const refresh = async () => {
    await refreshStore();
    dismissImpact();
  };
  const data = useStoreQuery(async (s) => {
    const [forecast, contacts, users, evidence, decisions] = await Promise.all([
      loadForecast(s),
      s.repos.contacts.list(),
      s.repos.users.list(),
      s.repos.evidence.list(),
      s.repos.evidenceDecisions.list(),
    ]);
    return { forecast, contacts, users, evidence, decisions };
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [modal, setModal] = useState<Action | null>(null);
  const [flash, setFlash] = useState<Effect | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the feed only, never the page around it.
    const feed = endRef.current?.parentElement;
    if (feed) feed.scrollTo({ top: feed.scrollHeight });
  }, [msgs]);

  if (!data) return <p>Loading…</p>;
  const { forecast: f, contacts, users } = data;
  const isManager = actingUser.role === "sales_manager";
  const myLines = f.lines.filter((l) => l.eligibility.kind === "evaluated" && (!isManager || l.managerId === actingUser.id));

  const post = (m: NewMsg | NewMsg[]) =>
    setMsgs((cur) => [...cur, ...(Array.isArray(m) ? m : [m]).map((x) => ({ ...x, id: nextId.current++ }) as Msg)]);

  async function run(command: string, act: () => Promise<{ ok: true; bot: Omit<Extract<Msg, { kind: "bot" }>, "id" | "kind" | "effect"> } | { ok: false; error: string }>) {
    const before = await loadForecast(store);
    const r = await act();
    if (!r.ok) {
      post({ kind: "note", text: r.error });
      return;
    }
    const after = await loadForecast(store);
    const effect = effectOf(before, after);
    post([
      { kind: "user", author: actingUser.name, text: command },
      { kind: "bot", ...r.bot, effect },
    ]);
    setFlash(effect);
    setModal(null);
    await refresh();
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (text.startsWith("/forecast")) {
      post([{ kind: "user", author: actingUser.name, text }, { kind: "menu" }]);
    } else {
      post([
        { kind: "user", author: actingUser.name, text },
        { kind: "note", text: "To change the forecast from here, type /forecast." },
      ]);
    }
  }

  async function decide(msgId: number, evidenceId: string, opportunityId: string, action: "approve" | "reject") {
    const evidence = data!.evidence.find((e) => e.id === evidenceId);
    const opp = f.lines.find((l) => l.view.opportunity.id === opportunityId)?.view.opportunity;
    if (evidence && opp && !allowedActions(actingUser, opp, evidence, evidenceStatus(evidence, data!.decisions)).includes(action)) {
      const revops = users.find((u) => u.role === "revops")!;
      post({
        kind: "note",
        text: `${CONDITION_LABEL[evidence.conditionType]} is reviewed by RevOps, not by ${actingUser.name}.`,
        switchTo: {
          userId: revops.id,
          label: `Approve as ${revops.name} (RevOps)`,
          then: async () => decideAs(msgId, evidenceId, action),
        },
      });
      return;
    }
    await decideAs(msgId, evidenceId, action);
  }

  async function decideAs(msgId: number, evidenceId: string, action: "approve" | "reject") {
    const before = await loadForecast(store);
    const r = await reviewEvidence(store, evidenceId, action, action === "reject" ? "Not supported" : "");
    if (!r.ok) {
      post({ kind: "note", text: Object.values(r.errors)[0] ?? "Refused." });
      return;
    }
    const after = await loadForecast(store);
    const effect = effectOf(before, after);
    setMsgs((cur) =>
      cur.map((m) =>
        m.id === msgId && m.kind === "bot" && m.approval ? { ...m, approval: { ...m.approval, state: action === "approve" ? "approved" : "rejected" } } : m,
      ),
    );
    const reviewer = (await store.repos.users.get((await store.repos.session.get("session"))!.actingUserId))?.name ?? "";
    post({
      kind: "bot",
      title: action === "approve" ? `${reviewer} approved it. It counts now.` : `${reviewer} rejected it. Nothing changes.`,
      lines: [],
      effect,
      tone: action === "approve" ? "good" : "neutral",
    });
    setFlash(effect);
    await refresh();
  }

  return (
    <section className="slack-page">
      <div className="page-head">
        <div>
          <h1>Slack</h1>
          <p className="muted subtitle">
            Sales leaders update the forecast where they already work. Type <code>/forecast</code> in the channel; the forecast on the right moves
            the moment you send.
          </p>
        </div>
        <label className="slack-as">
          <span className="muted small">Posting as</span>
          <select value={actingUser.id} onChange={(e) => void setActingUser(e.target.value)} aria-label="Posting as">
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role === "sales_manager" ? `Sales Manager, ${u.team}` : u.role === "revops" ? "RevOps" : u.role === "vp_sales" ? "VP Sales" : "CRO"})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="slack-split">
        <div className="slack" data-testid="slack">
          <aside className="slack-side" aria-label="Channels">
            <div className="slack-ws">Wonderful</div>
            <div className="slack-ch on"># forecast-q1</div>
            <div className="slack-ch"># sales-leadership</div>
            <div className="slack-ch"># deal-desk</div>
          </aside>
          <div className="slack-main">
            <div className="slack-head">
              <strong># forecast-q1</strong>
              <span className="muted small">Forecast bot posts here when the forecast moves</span>
            </div>
            <div className="slack-feed">
              <BotIntro isManager={isManager} name={actingUser.name} onMenu={() => post({ kind: "menu" })} />
              {msgs.map((m) => (
                <Message
                  key={m.id}
                  m={m}
                  onPick={(a) => setModal(a)}
                  onDecide={(id, ev, opp, a) => void decide(id, ev, opp, a)}
                  onSwitch={async (userId, then) => {
                    await setActingUser(userId);
                    await then();
                  }}
                />
              ))}
              <div ref={endRef} />
            </div>
            <form
              className="slack-composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message #forecast-q1, or type /forecast"
                aria-label="Message"
              />
              <button type="button" className="slack-bolt" onClick={() => post([{ kind: "user", author: actingUser.name, text: "/forecast" }, { kind: "menu" }])} aria-label="Run /forecast">
                /forecast
              </button>
              <button type="submit" className="btn btn-primary">Send</button>
            </form>
          </div>
        </div>

        <LivePanel forecast={f} flash={flash} />
      </div>

      {modal ? (
        <ActionModal
          action={modal}
          lines={myLines}
          contacts={contacts}
          actingUser={actingUser}
          users={users}
          asOf={f.asOf}
          quarterEnd={f.quarter.end}
          onClose={() => setModal(null)}
          onRun={run}
        />
      ) : null}
    </section>
  );
}

function BotIntro({ isManager, name, onMenu }: { isManager: boolean; name: string; onMenu: () => void }) {
  return (
    <div className="slack-msg bot">
      <span className="slack-avatar bot" aria-hidden>
        F
      </span>
      <div>
        <div className="slack-meta">
          <strong>Forecast</strong> <span className="slack-app">APP</span>
        </div>
        <p>
          Hi {name.split(" ")[0]}. Run <code>/forecast</code> to tell me what a customer said or to move a deal into or out of Commit. I&apos;ll
          show what it did to the numbers.
        </p>
        {!isManager ? (
          <p className="slack-hint">Tip: choose a Sales Manager under Posting as. Elena Ruiz runs Airline, National Bank, Retail and Savings; Jonas Weber runs Energy, Insurance and Telecom.</p>
        ) : null}
        <button type="button" className="slack-btn" onClick={onMenu}>
          Open /forecast
        </button>
      </div>
    </div>
  );
}

function Message(props: {
  m: Msg;
  onPick: (a: Action) => void;
  onDecide: (msgId: number, evidenceId: string, opportunityId: string, a: "approve" | "reject") => void;
  onSwitch: (userId: string, then: () => Promise<void>) => Promise<void>;
}) {
  const { m } = props;
  if (m.kind === "user") {
    return (
      <div className="slack-msg">
        <span className="slack-avatar" aria-hidden>
          {m.author
            .split(" ")
            .map((p) => p[0])
            .join("")}
        </span>
        <div>
          <div className="slack-meta">
            <strong>{m.author}</strong>
          </div>
          <p className={m.text.startsWith("/") ? "slack-cmd" : ""}>{m.text}</p>
        </div>
      </div>
    );
  }
  if (m.kind === "note") {
    return (
      <div className="slack-note" role="status">
        <span className="muted small">Only visible to you</span>
        <p>{m.text}</p>
        {m.switchTo ? (
          <button type="button" className="slack-btn primary" onClick={() => void props.onSwitch(m.switchTo!.userId, m.switchTo!.then)}>
            {m.switchTo.label}
          </button>
        ) : null}
      </div>
    );
  }
  if (m.kind === "menu") {
    return (
      <div className="slack-msg bot">
        <span className="slack-avatar bot" aria-hidden>
          F
        </span>
        <div className="slack-menu" data-testid="slack-menu">
          <div className="slack-meta">
            <strong>Forecast</strong> <span className="slack-app">APP</span> <span className="muted small">Only visible to you</span>
          </div>
          <p>What happened?</p>
          <div className="slack-actions">
            {ACTIONS.map((a) => (
              <button key={a.key} type="button" className="slack-action" onClick={() => props.onPick(a.key)}>
                <span aria-hidden>{a.icon}</span>
                <span>
                  <strong>{a.title}</strong>
                  <span className="muted small">{a.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`slack-msg bot tone-${m.tone ?? "neutral"}`} data-testid="slack-bot">
      <span className="slack-avatar bot" aria-hidden>
        F
      </span>
      <div className="slack-card">
        <div className="slack-meta">
          <strong>Forecast</strong> <span className="slack-app">APP</span>
        </div>
        <p className="slack-title">{m.title}</p>
        {m.quote ? <blockquote>{m.quote}</blockquote> : null}
        {m.lines.map((l) => (
          <p key={l} className="slack-line">
            {l}
          </p>
        ))}
        {m.effect ? <EffectBlock e={m.effect} /> : null}
        {m.approval ? (
          m.approval.state === "waiting" ? (
            <div className="slack-buttons">
              <button type="button" className="slack-btn primary" data-testid="slack-approve" onClick={() => props.onDecide(m.id, m.approval!.evidenceId, m.approval!.opportunityId, "approve")}>
                Approve
              </button>
              <button type="button" className="slack-btn" onClick={() => props.onDecide(m.id, m.approval!.evidenceId, m.approval!.opportunityId, "reject")}>
                Reject
              </button>
            </div>
          ) : (
            <p className="muted small">{m.approval.state === "approved" ? "✓ Approved" : "✗ Rejected"}</p>
          )
        ) : null}
        {m.link ? (
          <Link href={m.link.href} className="slack-link">
            {m.link.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function delta(a: Cents, b: Cents): ReactNode {
  if (a === b) return <span className="muted">{formatAmount(a)}, no change</span>;
  const d = (b - a) as Cents;
  return (
    <>
      {formatAmount(a)} → <strong>{formatAmount(b)}</strong>{" "}
      <span className={d > 0 ? "up" : "down"}>
        ({d > 0 ? "+" : "−"}
        {formatAmount(Math.abs(d) as Cents)})
      </span>
    </>
  );
}

function EffectBlock({ e }: { e: Effect }) {
  return (
    <div className="slack-effect">
      <div>
        <span className="muted small">System forecast</span> {delta(e.core[0], e.core[1])}
      </div>
      <div>
        <span className="muted small">Managers&apos; Commit</span> {delta(e.commit[0], e.commit[1])}
      </div>
      {e.moved.map((m) => (
        <div key={m.id}>
          <strong>{m.name}</strong>: {m.from ? COLUMN_LABEL[m.from] : "—"} → {m.to ? COLUMN_LABEL[m.to] : "—"}
        </div>
      ))}
    </div>
  );
}

function LivePanel({ forecast: f, flash }: { forecast: Forecast; flash: Effect | null }) {
  const c = f.company;
  const by: Record<Column, ForecastLine[]> = { yes: [], maybe: [], no: [] };
  for (const l of f.lines) {
    const k = columnOf(l);
    if (k) by[k].push(l);
  }
  const moved = new Set(flash?.moved.map((m) => m.id) ?? []);
  const changed = (pair: [Cents, Cents] | undefined) => pair && pair[0] !== pair[1];
  const key = flash ? `${flash.core.join()}-${flash.commit.join()}-${flash.moved.map((m) => m.id).join()}` : "none";
  return (
    <aside className="live" aria-label="Live forecast" data-testid="live-forecast" key={key}>
      <div className="live-head">
        <span className="live-dot" aria-hidden /> Live forecast, {f.quarter.label}
      </div>
      <div className={`live-num${changed(flash?.core) ? " pulse" : ""}`}>
        <span className="muted small">System forecast</span>
        <strong data-testid="live-core">{formatAmount(c.core)}</strong>
        {c.target !== null ? <span className="muted small">of {formatAmount(c.target)} target</span> : null}
      </div>
      <div className={`live-num manager${changed(flash?.commit) ? " pulse" : ""}`}>
        <span className="muted small">Managers&apos; Commit</span>
        <strong data-testid="live-commit">{formatAmount(c.managerCommitment)}</strong>
      </div>
      {(["yes", "maybe", "no"] as Column[]).map((k) => (
        <div key={k} className={`live-col q-${k}`}>
          <div className="live-col-head">
            <span>{COLUMN_LABEL[k]}</span>
            <strong>{formatAmount(by[k].reduce((a, l) => a + (l.tcv ?? 0), 0) as Cents)}</strong>
          </div>
          <div className="live-chips">
            {by[k]
              .sort((a, b) => (b.tcv ?? 0) - (a.tcv ?? 0))
              .map((l) => (
                <Link key={l.view.opportunity.id} href={`/forecast/deals/${l.view.opportunity.id}`} className={`live-chip${moved.has(l.view.opportunity.id) ? " arrived" : ""}`}>
                  {l.view.account?.name ?? l.view.opportunity.name} <span className="muted">{l.tcv === null ? "" : formatAmount(l.tcv)}</span>
                </Link>
              ))}
          </div>
        </div>
      ))}
      <Link href="/forecast" className="small">
        Open the full forecast
      </Link>
    </aside>
  );
}

function ActionModal(props: {
  action: Action;
  lines: ForecastLine[];
  contacts: readonly Contact[];
  actingUser: User;
  users: readonly User[];
  asOf: IsoDate;
  quarterEnd: IsoDate;
  onClose: () => void;
  onRun: (
    command: string,
    act: () => Promise<
      | { ok: true; bot: { title: string; lines: string[]; quote?: string; approval?: { evidenceId: string; opportunityId: string; state: "waiting" }; link?: { href: string; label: string }; tone?: "good" | "bad" | "neutral" } }
      | { ok: false; error: string }
    >,
  ) => Promise<void>;
}) {
  const { action, lines, contacts, actingUser, asOf, quarterEnd } = props;
  const { store } = useStore();
  const counted = (l: ForecastLine) => ["firm", "core"].includes(l.group);
  const candidates = lines.filter((l) => {
    const live = l.dispute?.status.live;
    if (action === "in") return !live && !counted(l) && l.group !== "signed";
    if (action === "out") return !live && counted(l);
    if (action === "undo") return !!live && l.dispute!.dispute.managerId === actingUser.id;
    return true;
  });
  const [oppId, setOppId] = useState(candidates[0]?.view.opportunity.id ?? "");
  const line = candidates.find((l) => l.view.opportunity.id === oppId) ?? candidates[0];
  const open = line ? line.view.states.filter((s) => s.state !== "done" && s.state !== "waived").map((s) => s.type) : [];
  const [step, setStep] = useState<ConditionType | "">("");
  const stepNow = (step && open.includes(step) ? step : open[0]) ?? "";
  const [kind, setKind] = useState<CustomerUpdateKind>(action === "bad" ? "blocked" : "done");
  const people = line ? contacts.filter((c) => c.accountId === line.view.opportunity.accountId && c.active) : [];
  const [contactId, setContactId] = useState("");
  const contactNow = people.find((p) => p.id === contactId)?.id ?? people[0]?.id ?? "";
  const [quote, setQuote] = useState<string | null>(null);
  const k = action === "bad" ? "blocked" : kind;
  const quoteNow = quote ?? (stepNow ? (QUOTES[stepNow]?.[k as "done"] ?? "") : "");
  const [until, setUntil] = useState<string>(addDays(asOf, 40));
  const [noDate, setNoDate] = useState(false);
  const [reason, setReason] = useState("");
  const [by, setBy] = useState<string>(quarterEnd);
  const meta = ACTIONS.find((a) => a.key === action)!;
  const name = line ? (line.view.account?.name ?? line.view.opportunity.name) : "";

  async function submit() {
    if (!line) return;
    const o = line.view.opportunity;
    if (action === "good" || action === "bad") {
      const contact = people.find((p) => p.id === contactNow);
      const untilDate = action === "bad" && !noDate ? (until as IsoDate) : null;
      await props.onRun(`/forecast ${action === "good" ? "good-news" : "bad-news"} ${name}: ${SHORT_LABEL[stepNow as ConditionType]}`, async () => {
        const r = await logCustomerUpdate(store, {
          opportunityId: o.id,
          conditionType: stepNow as ConditionType,
          kind: k,
          contactId: contactNow,
          quote: quoteNow,
          until: untilDate,
        });
        if (!r.ok) return { ok: false, error: Object.values(r.errors)[0] ?? "Refused." };
        const stepLabel = CONDITION_LABEL[stepNow as ConditionType];
        return action === "good"
          ? {
              ok: true,
              bot: {
                title: `${name}: ${stepLabel.toLowerCase()} ${k === "done" ? "done" : k === "progress" ? "moving" : "started"}, says ${contact?.name}. Waiting for review.`,
                quote: quoteNow,
                lines: ["Good news counts once it is approved, so one optimistic message can't inflate the number."],
                approval: { evidenceId: r.value.evidence.id, opportunityId: o.id, state: "waiting" },
                tone: "good",
              },
            }
          : {
              ok: true,
              bot: {
                title: `${name}: ${stepLabel.toLowerCase()} on hold${untilDate ? ` until ${short(untilDate)}` : ", no end date"}, says ${contact?.name}. Applied now.`,
                quote: quoteNow,
                lines: ["Bad news counts the moment it is reported. The manager or RevOps confirms it later."],
                link: { href: `/forecast/deals/${o.id}`, label: `See ${name}'s Signature Path` },
                tone: "bad",
              },
            };
      });
      return;
    }
    if (action === "in" || action === "out") {
      await props.onRun(`/forecast ${action === "in" ? "commit" : "uncommit"} ${name}`, async () => {
        const r = await raiseDispute(store, {
          opportunityId: o.id,
          direction: action,
          reason,
          bets: action === "in" && stepNow ? [{ conditionType: stepNow as ConditionType, by: by as IsoDate }] : [],
          outCondition: action === "out" && stepNow ? (stepNow as ConditionType) : null,
        });
        if (!r.ok) return { ok: false, error: Object.values(r.errors)[0] ?? "Refused." };
        return {
          ok: true,
          bot: {
            title:
              action === "in"
                ? `${actingUser.name} moved ${name} into Commit, betting ${CONDITION_LABEL[stepNow as ConditionType].toLowerCase()} is done by ${short(by as IsoDate)}.`
                : `${actingUser.name} moved ${name} out of Commit, doubting ${CONDITION_LABEL[stepNow as ConditionType].toLowerCase()}.`,
            quote: reason,
            lines: [
              action === "in"
                ? "The system forecast stays as it is; the move shows in Managers' Commit. If the bet date passes with the step open, the move stops counting."
                : "The system forecast stays as it is; the move shows in Managers' Commit.",
            ],
            tone: "neutral",
          },
        };
      });
      return;
    }
    await props.onRun(`/forecast undo ${name}`, async () => {
      const r = await withdrawDispute(store, line.dispute!.dispute.id);
      if (!r.ok) return { ok: false, error: Object.values(r.errors)[0] ?? "Refused." };
      return { ok: true, bot: { title: `${actingUser.name} withdrew the move on ${name}. Managers' Commit follows the system again for this deal.`, lines: [], tone: "neutral" } };
    });
  }

  const managerHint =
    actingUser.role === "sales_manager" ? null : action === "in" || action === "out" || action === "undo" ? "Only the deal's Sales Manager can move a deal. Choose one under Posting as." : null;

  return (
    <div className="slack-modal-back" role="dialog" aria-modal="true" aria-label={meta.title}>
      <form
        className="slack-modal"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="slack-modal-head">
          <strong>
            {meta.icon} {meta.title}
          </strong>
          <button type="button" className="slack-x" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        {managerHint ? <p className="slack-hint">{managerHint}</p> : null}
        {candidates.length === 0 ? (
          <p className="muted">
            {action === "undo" ? "You have no live moves to undo." : action === "out" ? "None of your counted deals is free to move." : "No deal of yours fits this action."}
          </p>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Deal</span>
              <select value={line?.view.opportunity.id} onChange={(e) => { setOppId(e.target.value); setStep(""); setContactId(""); setQuote(null); }} aria-label="Deal">
                {candidates.map((l) => (
                  <option key={l.view.opportunity.id} value={l.view.opportunity.id}>
                    {l.view.account?.name ?? l.view.opportunity.name} ({l.tcv === null ? "—" : formatAmount(l.tcv)}, {COLUMN_LABEL[columnOf(l) ?? "no"].toLowerCase()})
                  </option>
                ))}
              </select>
            </label>
            {action !== "undo" ? (
              <label className="field">
                <span className="field-label">{action === "in" ? "The step you bet on" : action === "out" ? "The step you doubt" : "Step"}</span>
                <select value={stepNow} onChange={(e) => { setStep(e.target.value as ConditionType); setQuote(null); }} aria-label="Step">
                  {open.map((t) => (
                    <option key={t} value={t}>
                      {CONDITION_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {action === "good" ? (
              <label className="field">
                <span className="field-label">What happened</span>
                <select value={kind} onChange={(e) => { setKind(e.target.value as CustomerUpdateKind); setQuote(null); }} aria-label="What happened">
                  <option value="done">Done</option>
                  <option value="progress">Moving forward</option>
                  <option value="started">Started</option>
                </select>
              </label>
            ) : null}
            {action === "bad" ? (
              <div className="field">
                <span className="field-label">On hold until</span>
                <div className="slack-row">
                  <input type="date" value={until} min={addDays(asOf, 1)} onChange={(e) => setUntil(e.target.value)} disabled={noDate} aria-label="On hold until" />
                  <label className="small">
                    <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} /> They gave no date
                  </label>
                </div>
              </div>
            ) : null}
            {action === "good" || action === "bad" ? (
              <>
                <label className="field">
                  <span className="field-label">Who said it</span>
                  <select value={contactNow} onChange={(e) => setContactId(e.target.value)} aria-label="Who said it">
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}, {p.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">What they said</span>
                  <textarea rows={2} value={quoteNow} onChange={(e) => setQuote(e.target.value)} aria-label="What they said" />
                </label>
              </>
            ) : null}
            {action === "in" ? (
              <label className="field">
                <span className="field-label">Done by</span>
                <input type="date" value={by} max={quarterEnd} min={asOf} onChange={(e) => setBy(e.target.value)} aria-label="Done by" />
              </label>
            ) : null}
            {action === "in" || action === "out" ? (
              <label className="field">
                <span className="field-label">Why</span>
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you know that the system doesn't" aria-label="Why" />
              </label>
            ) : null}
            <div className="slack-modal-foot">
              <button type="button" className="btn" onClick={props.onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" data-testid="slack-submit">
                Send
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
