"use client";

// How it works: the forecast brain (the approach and the business logic) and the build (the technical side).
// Numbers on this page come from the live engine, so they always match the forecast.

import Link from "next/link";
import { loadForecast } from "@/application/forecast";
import { formatAmount } from "@/domain/money";
import { useStoreQuery } from "@/features/crm/ui";

const TOC: { id: string; label: string; part?: string }[] = [
  { id: "problem", label: "The problem", part: "The forecast brain" },
  { id: "idea", label: "The idea" },
  { id: "principles", label: "Seven principles" },
  { id: "journey", label: "One email, end to end" },
  { id: "rules", label: "How a deal is placed" },
  { id: "range", label: "The number and its range" },
  { id: "managers", label: "Managers' judgement" },
  { id: "people", label: "Who does what" },
  { id: "ai", label: "Where AI fits" },
  { id: "metrics", label: "Business metrics" },
  { id: "not", label: "What we chose not to do" },
  { id: "architecture", label: "Architecture", part: "The build" },
  { id: "guarantees", label: "Guarantees" },
  { id: "quality", label: "Testing and delivery" },
];

const PRINCIPLES = [
  {
    t: "Evidence, not opinion",
    d: "A step moves only when something the customer wrote or did says so. Our own words (\"I think they'll sign\") are kept but never move a step.",
  },
  {
    t: "Bad news fast, good news checked",
    d: "A hold or a contrary signal counts the moment it arrives. Good news waits for a reviewer. The forecast errs toward surprise on the upside, never the downside.",
  },
  {
    t: "Time, not probability",
    d: "Instead of \"60% likely\", the system asks: with the steps still open, at a slow, standard or fast pace, does the signature land before quarter end?",
  },
  {
    t: "One system number, judgement on top",
    d: "The system forecast is computed. Managers can disagree, but their moves sit in a separate Managers' Commit, each with a reason and a bet the system checks daily.",
  },
  {
    t: "Every number traces to a sentence",
    d: "From the headline down to a deal, a step and the quote that set it. Nobody has to trust a black box.",
  },
  {
    t: "Weekly runs are frozen",
    d: "Each week's forecast is stored and never rewritten, so \"what changed since last week\" is exact and the method can be scored against what actually signed.",
  },
  {
    t: "The CRM is the single source of truth",
    d: "Emails, calls and pilot readings sync in from the CRM. Nobody types the forecast, and nobody pastes emails into it.",
  },
];

const JOURNEY = [
  {
    stage: "Event",
    what: "The CRM syncs a customer email. Stored once, matched by Message-ID or content hash, so a re-sync never double-counts.",
    ex: "Feb 24: email from Luca Bianchi, CISO at National Bank.",
  },
  {
    stage: "Evidence",
    what: "AI reads the text and extracts a claim about one step: which step, done or blocked, until when, with the exact quote.",
    ex: "“The risk committee sitting has moved to March 16.”",
  },
  {
    stage: "Step state",
    what: "Each step on the Signature Path is done, in progress, blocked or not started, from its evidence alone.",
    ex: "Security approval: blocked until Mar 16.",
  },
  {
    stage: "Timing",
    what: "Remaining days per step at fast, standard and slow pace, from approved planning standards, respecting the order steps must run in.",
    ex: "At standard pace it now signs Apr 16.",
  },
  {
    stage: "Group",
    what: "Customer commitment and timing together place the deal in one group.",
    ex: "Late: after the quarter. Not counted.",
  },
  {
    stage: "Forecast",
    what: "The system forecast, its range, Managers' Commit on top, and a line in What changed.",
    ex: "System forecast −$20M, explained.",
  },
];

const PEOPLE = [
  { role: "Sales Manager", does: "Reports what customers said (also from Slack), moves own deals into or out of Managers' Commit with a reason and a bet, approves most good news on own deals." },
  { role: "RevOps", does: "Owns the rules: planning standards (step durations), waivers, and approval of the evidence that matters most (budget, pilot results, vendor selection)." },
  { role: "VP Sales", does: "Reviews any evidence, can reject even approved evidence, and sees where managers and the system disagree." },
  { role: "CRO", does: "Reads the number, its range and what changed. Never edits it." },
];

const METRICS = [
  { m: "Gap to target", d: "System forecast against the quarter target, and how much of the gap the Stretch deals could close." },
  { m: "Range", d: "Conservative (Signed + Firm), System (adds Core), Best case (adds Stretch). The width is the honest uncertainty." },
  { m: "Judgement gap", d: "Managers' Commit minus the system forecast, per manager. A big gap is a conversation, not an error." },
  { m: "Bridge", d: "What changed since last week, deal by deal: slipped, pulled in, new, lost, re-sized, with the evidence behind each." },
  { m: "Precision and capture", d: "Backtest on closed quarters: of what we counted, how much signed; of what signed, how much we counted." },
  { m: "Timing bias", d: "On average, how many days early or late the forecast signature date was. Feeds back into planning standards." },
  { m: "Pilot trend", d: "Readings against the target, projected to the evaluation date, so a failing pilot shows up weeks before it fails." },
];

const NOT_DONE = [
  { t: "No stage probabilities", d: "\"Contract stage = 80%\" says nothing about this customer. Stages stay in the CRM for the team; the forecast reads steps." },
  { t: "No AI score deciding the number", d: "A model's confidence can't be audited by a CFO. AI reads text; deterministic rules decide; people approve." },
  { t: "No manual email pasting", d: "The CRM integration brings everything in. A forecast that depends on someone remembering to paste is not a system." },
  { t: "No silent overrides", d: "A manager can disagree, but never by editing the system number. Every move is visible, reasoned and re-checked." },
];

const LAYERS = [
  { name: "Screens", path: "src/app, src/features", role: "Next.js pages and components. They render what the application layer returns. No forecast logic here." },
  { name: "Application", path: "src/application", role: "Use cases: load the forecast, log a customer update, raise a dispute, approve evidence, freeze a weekly run. Storage only through ports." },
  { name: "Engine", path: "src/domain", role: "Step states, timing, classification, disputes, the bridge, backtest, money. Pure TypeScript, no dependencies.", core: true },
  { name: "Storage and adapters", path: "src/infrastructure", role: "IndexedDB in the browser, in-memory for tests, the email parser and the extraction provider, all behind contracts." },
];

const GUARANTEES = [
  { t: "Same data, same day, same number", d: "The engine is pure. A test fails the build if any engine file reads the clock, randomness, storage, network or environment." },
  { t: "Amounts never drift", d: "Money is integer cents in a branded type. Rounding happens only on screen." },
  { t: "Nothing is rewritten", d: "Events, evidence, decisions, runs and the change log are append-only. A property test fires random writes and checks frozen runs still hash the same." },
  { t: "Idempotent sync", d: "The same email synced twice is stored once (Message-ID, then content hash)." },
  { t: "Permissions in the use case", d: "Who may approve, waive or move a deal is checked in the application layer, not just hidden in the UI." },
  { t: "Versioned extraction", d: "Every evidence record carries the extraction version that produced it, so a model change is traceable and replayable." },
];

export default function HowItWorks() {
  const f = useStoreQuery((s) => loadForecast(s), []);
  const c = f?.company;
  const n = (x: number | null | undefined) => (x === null || x === undefined ? "…" : formatAmount(x as never));

  return (
    <section className="hiw">
      <header className="hiw-hero">
        <p className="hiw-kicker">How it works</p>
        <h1>A forecast you can argue with, line by line</h1>
        <p className="hiw-lede">
          Most forecasts are a stage probability multiplied by a rep&apos;s optimism. This one is computed from what customers actually said
          and did, placed on a timeline, and kept separate from human judgement, so every number can be traced and challenged.
        </p>
        <div className="hiw-stats" aria-label="Live numbers">
          <div>
            <span>System forecast</span>
            <strong>{n(c?.core)}</strong>
          </div>
          <div>
            <span>Range</span>
            <strong>
              {n(c?.conservative)} to {n(c?.stretch)}
            </strong>
          </div>
          <div>
            <span>Target</span>
            <strong>{n(c?.target)}</strong>
          </div>
          <div>
            <span>Managers&apos; Commit</span>
            <strong className="mgr">{n(c?.managerCommitment)}</strong>
          </div>
        </div>
        <p className="hiw-note">Live from the engine, {f ? f.quarter.label : ""}.</p>
      </header>

      <div className="hiw-body">
        <nav className="hiw-toc" aria-label="On this page">
          {TOC.map((t) => (
            <div key={t.id}>
              {t.part ? <p className="hiw-toc-part">{t.part}</p> : null}
              <a href={`#${t.id}`}>{t.label}</a>
            </div>
          ))}
        </nav>

        <div className="hiw-content">
          <p className="hiw-part">Part 1 · The forecast brain</p>

          <section id="problem" className="hiw-sec">
            <h2>The problem</h2>
            <p>
              A typical B2B forecast takes each deal&apos;s CRM stage, multiplies the amount by a stage probability, and lets the rep override it.
              Two things go wrong. A stage is a label the seller sets, so it says little about whether <em>this</em> customer will sign <em>this</em>{" "}
              quarter. And the override mixes evidence with hope, so when the number misses, nobody can say why.
            </p>
            <p>
              For a company selling large AI deployments to enterprises, the gap is bigger: deals run through security reviews, pilots with
              measurable targets, procurement and legal. Whether they sign this quarter is a question of which of those steps are done and how long
              the rest take.
            </p>
          </section>

          <section id="idea" className="hiw-sec">
            <h2>The idea: the Signature Path</h2>
            <p>
              Every deal has a short list of steps the customer must complete before signing: executive sponsor, budget, technical validation,
              pilot, security, vendor selection, procurement and legal. That list is the deal&apos;s <strong>Signature Path</strong>.
            </p>
            <div className="hiw-path" aria-hidden>
              {["Sponsor", "Budget", "Validation", "Pilot", "Security", "Vendor", "Legal", "Signature"].map((s, i) => (
                <span key={s} className={i < 3 ? "done" : i === 3 ? "now" : i === 7 ? "end" : ""}>
                  {s}
                </span>
              ))}
            </div>
            <p>
              The forecast asks two questions of every deal. <strong>Is the customer committed?</strong> (sponsor, budget, pilot on track, vendor
              chosen, talked to us in the last 30 days.) <strong>Does the timing fit?</strong> (with the open steps at a slow, standard or fast
              pace, does the signature land before quarter end?) The answers place the deal; the placement sets the number.
            </p>
          </section>

          <section id="principles" className="hiw-sec">
            <h2>Seven principles</h2>
            <div className="hiw-grid">
              {PRINCIPLES.map((p, i) => (
                <div key={p.t} className="hiw-card">
                  <span className="hiw-num">{i + 1}</span>
                  <strong>{p.t}</strong>
                  <p>{p.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="journey" className="hiw-sec">
            <h2>One email, end to end</h2>
            <p className="hiw-intro">National Bank&apos;s CISO writes that the risk committee moved. Here is what happens, with no one touching the forecast.</p>
            <ol className="hiw-flow">
              {JOURNEY.map((j, i) => (
                <li key={j.stage}>
                  <span className="hiw-dot" aria-hidden>
                    {i + 1}
                  </span>
                  <div>
                    <strong>{j.stage}</strong>
                    <p>{j.what}</p>
                    <p className="hiw-ex">{j.ex}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="hiw-see">
              See it: <Link href="/forecast/deals/opp-natbank">National Bank&apos;s Signature Path</Link> and <Link href="/forecast">What changed</Link>.
            </p>
          </section>

          <section id="rules" className="hiw-sec">
            <h2>How a deal is placed</h2>
            <p>Commitment and timing together decide the group. Only the first three groups count.</p>
            <div className="hiw-table-wrap">
              <table className="hiw-matrix">
                <thead>
                  <tr>
                    <th scope="col">Customer is…</th>
                    <th scope="col">Signs this quarter even at slow pace</th>
                    <th scope="col">Only at standard pace</th>
                    <th scope="col">Only at fast pace</th>
                    <th scope="col">Not this quarter</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Committed</th>
                    <td className="g-firm">
                      Firm<small>if budget and award are in writing, else Core</small>
                    </td>
                    <td className="g-core">Core</td>
                    <td className="g-stretch">Stretch</td>
                    <td className="g-out">Late</td>
                  </tr>
                  <tr>
                    <th scope="row">Engaged (no vendor decision yet)</th>
                    <td className="g-stretch">Stretch</td>
                    <td className="g-stretch">Stretch</td>
                    <td className="g-out">Uncommitted</td>
                    <td className="g-out">Uncommitted</td>
                  </tr>
                  <tr>
                    <th scope="row">Unproven or at risk</th>
                    <td className="g-out" colSpan={4}>
                      Uncommitted
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="hiw-legend">
              <li>
                <span className="g-firm" /> Firm, <span className="g-core" /> Core: counted
              </li>
              <li>
                <span className="g-stretch" /> Stretch: upside, not counted
              </li>
              <li>
                <span className="g-out" /> Late, Uncommitted: not counted
              </li>
            </ul>
            <p className="hiw-small">
              Signed deals count as signed. A pilot that misses its targets at evaluation, or any contrary signal from the customer, makes the
              customer &quot;at risk&quot; until it is resolved. Timing comes from planning standards that RevOps approves per step and segment, in
              versions, so a change of rules is dated and visible.
            </p>
          </section>

          <section id="range" className="hiw-sec">
            <h2>The number and its range</h2>
            <div className="hiw-range">
              <div className="cons">
                <span>Conservative</span>
                <strong>{n(c?.conservative)}</strong>
                <small>Signed + Firm: signs even if everything is slow</small>
              </div>
              <div className="sys">
                <span>System forecast</span>
                <strong>{n(c?.core)}</strong>
                <small>+ Core: signs at a normal pace</small>
              </div>
              <div className="best">
                <span>Best case</span>
                <strong>{n(c?.stretch)}</strong>
                <small>+ Stretch: needs a fast pace or a vendor decision</small>
              </div>
            </div>
            <p>
              One number is what the CRO reports; the range is how much to trust it. The home page also answers the plain question per deal
              (signs this quarter, could sign, not this quarter) and what changed since last week.
            </p>
          </section>

          <section id="managers" className="hiw-sec">
            <h2>Managers&apos; judgement, kept separate</h2>
            <p>
              Managers know things the evidence doesn&apos;t show yet. They can move a deal <strong>into</strong> Managers&apos; Commit by betting
              that named steps will be done by a date; the move is accepted only if those steps would really make the deal count. Or they move a
              deal <strong>out</strong>, naming the step they doubt. The system checks every bet daily; if a date passes with the step still open,
              the move stops counting.
            </p>
            <p>
              The result is two honest numbers side by side: what the evidence says, and what the managers believe. The gap between them is where
              a forecast call should spend its time.
            </p>
          </section>

          <section id="people" className="hiw-sec">
            <h2>Who does what</h2>
            <div className="hiw-people">
              {PEOPLE.map((p) => (
                <div key={p.role}>
                  <strong>{p.role}</strong>
                  <p>{p.does}</p>
                </div>
              ))}
            </div>
            <p className="hiw-small">
              Managers can do the most common actions from <Link href="/slack">Slack</Link>: report good or bad news, move a deal, undo a move, and
              see at once what it did to the number.
            </p>
          </section>

          <section id="ai" className="hiw-sec hiw-ai">
            <h2>Where AI fits: it reads, rules decide, people approve</h2>
            <p>
              The hardest input to a forecast is unstructured: emails, call notes, meeting transcripts. That is where a language model is strong,
              and that is where it sits. The <strong>extraction provider</strong> reads each synced message and returns structured evidence: which
              step it is about, whether it is progress, done or a hold, the hold dates, and the exact quote that supports it.
            </p>
            <div className="hiw-ai-flow" aria-hidden>
              <span>Email or call</span>
              <i>→</i>
              <span className="ai">AI extraction</span>
              <i>→</i>
              <span>Evidence with quote</span>
              <i>→</i>
              <span>Review if good news</span>
              <i>→</i>
              <span>Deterministic rules</span>
            </div>
            <ul className="hiw-list">
              <li>
                <strong>The model never sets the number.</strong> It proposes evidence; rules a CFO can read decide the group.
              </li>
              <li>
                <strong>Every claim carries a quote,</strong> so a hallucination is visible: the sentence is either in the email or it is not.
              </li>
              <li>
                <strong>Good news is reviewed by a person</strong> before it counts; bad news counts at once and is confirmed later.
              </li>
              <li>
                <strong>Every evidence record carries its extraction version.</strong> A model upgrade can be replayed against frozen weeks before it
                goes live.
              </li>
            </ul>
            <p className="hiw-small">
              In this demo the extraction results are stored per email so the forecast is fully reproducible, as the spec requires. In production
              the same port calls a model; nothing else in the system changes.
            </p>
          </section>

          <section id="metrics" className="hiw-sec">
            <h2>Business metrics</h2>
            <dl className="hiw-metrics">
              {METRICS.map((m) => (
                <div key={m.m}>
                  <dt>{m.m}</dt>
                  <dd>{m.d}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="not" className="hiw-sec">
            <h2>What we chose not to do</h2>
            <div className="hiw-grid two">
              {NOT_DONE.map((x) => (
                <div key={x.t} className="hiw-card no">
                  <strong>{x.t}</strong>
                  <p>{x.d}</p>
                </div>
              ))}
            </div>
          </section>

          <p className="hiw-part">Part 2 · The build</p>

          <section id="architecture" className="hiw-sec">
            <h2>Architecture</h2>
            <p className="hiw-intro">Dependencies point inward. Everything depends on the engine; the engine depends on nothing.</p>
            <div className="hiw-layers">
              {LAYERS.map((l) => (
                <div key={l.name} className={l.core ? "core" : ""}>
                  <div className="hiw-layer-head">
                    <strong>{l.name}</strong>
                    <code>{l.path}</code>
                  </div>
                  <p>{l.role}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="guarantees" className="hiw-sec">
            <h2>Guarantees, enforced by tests</h2>
            <div className="hiw-grid">
              {GUARANTEES.map((g) => (
                <div key={g.t} className="hiw-card">
                  <strong>{g.t}</strong>
                  <p>{g.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="quality" className="hiw-sec">
            <h2>Testing and delivery</h2>
            <ul className="hiw-list">
              <li>
                <strong>The spec is the test plan.</strong> All 61 acceptance tests in the spec are traced to automated tests.
              </li>
              <li>
                <strong>227 unit, integration and property tests</strong> (Vitest with fast-check) run on every change, plus a browser run
                (Playwright) that clicks through the app, including the Slack flow.
              </li>
              <li>
                <strong>Typed end to end:</strong> TypeScript in strict mode, ESLint with accessibility rules.
              </li>
              <li>
                <strong>Continuous deployment:</strong> every push builds and goes live on Vercel.
              </li>
            </ul>
            <p className="hiw-small">Next.js 15, React 19, TypeScript, IndexedDB.</p>
          </section>
        </div>
      </div>
    </section>
  );
}
